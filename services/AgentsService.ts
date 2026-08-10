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
  name?: string;
  model?: string;
  unit?: string;
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
    item_id?: number | null;
  };
}

export interface AgentRunForex {
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
}

export interface AgentRunData {
  customer?: string | null;
  customer_code?: string | null;
  code?: string | null;
  inv_date?: string | null;
  currency?: string | null;
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

export interface AgentRun {
  id: number;
  agent_id: number;
  user_id: number;
  organization_id?: number | null;
  status: string;
  revision?: number;
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
  error_message?: string | null;
  received_at?: string | null;
  extracted_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  completed_at?: string | null;
  events: AgentRunEvent[];
}

export interface AgentRunListItem {
  id: number;
  agent_id: number;
  status: string;
  source_channel?: string | null;
  source_filename?: string | null;
  source_caption?: string | null;
  po_label?: string | null;
  agent_name?: string | null;
  received_at?: string | null;
  completed_at?: string | null;
}

export interface AgentRunListResponse {
  runs: AgentRunListItem[];
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

export async function listRuns(params: { agentId?: number; status?: string; page?: number; pageSize?: number } = {}): Promise<AgentRunListResponse> {
  const q = new URLSearchParams();
  if (params.agentId != null) q.set('agent_id', String(params.agentId));
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  const res = await fetch(`${BASE_URL}/agents/runs?${q.toString()}`, { headers: getScopedHeaders() });
  return handle<AgentRunListResponse>(res);
}

export async function getRun(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}`, { headers: getScopedHeaders() });
  return handle<AgentRun>(res);
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

export async function uploadPaymentBundle(agentId: number, files: File[], caption: string): Promise<AgentRun> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  form.append('caption', caption);
  const res = await fetch(`${BASE_URL}/agents/${agentId}/runs/payment-bundle`, { method: 'POST', headers: getScopedHeadersForFormData(), body: form });
  return handle<AgentRun>(res);
}

export async function reviewRun(runId: number, correctedData: AgentRunData): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/review`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ corrected_data: correctedData }),
  });
  return handle<AgentRun>(res);
}

export async function refreshPaymentPreview(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/refresh-payment-preview`, {
    method: 'POST', headers: getScopedHeaders(),
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

export async function approveRun(runId: number, correctedData?: AgentRunData): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/approve`, {
    method: 'POST', headers: getScopedHeaders(),
    body: JSON.stringify({ corrected_data: correctedData ?? null }),
  });
  return handle<AgentRun>(res);
}

export async function sendRunToWhatsApp(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/send-whatsapp`, {
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
