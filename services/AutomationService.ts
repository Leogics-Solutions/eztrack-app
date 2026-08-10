import { getScopedHeaders } from './apiHelpers';
import { BASE_URL } from './config';

export type AutomationStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED';
export type AutomationTemplateKey = 'order_to_invoice' | 'payment_knock_off';
export type AutomationFieldType = 'TEXT' | 'NUMBER' | 'MONEY' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'ENTITY' | 'OBJECT';
export type AutomationAgentTool = 'KNOWLEDGE_SEARCH_ENTITIES' | 'KNOWLEDGE_FIND_DOCUMENT_TEMPLATE' | 'SQL_SEARCH_CUSTOMER' | 'SQL_SEARCH_ITEM' | 'SQL_CHECK_DUPLICATE' | 'SQL_CREATE_DELIVERY_ORDER' | 'SQL_CREATE_INVOICE_FROM_DO' | 'SQL_GET_DOCUMENT_PDF' | 'SMARTDOK_RENDER_DOCUMENTS' | 'WHATSAPP_SEND_DOCUMENTS' | 'EMAIL_SEND_OUTSOURCE_REQUEST' | 'EMAIL_WAIT_FOR_REPLY' | 'EMAIL_RECEIVE_DOCUMENTS' | 'SQL_LIST_OPEN_RECEIVABLES' | 'SQL_LIST_PAYMENT_METHODS' | 'SQL_CHECK_DUPLICATE_RECEIPT' | 'SQL_CREATE_CUSTOMER_PAYMENT' | 'SQL_GET_RECEIPT_PDF' | 'SOURCE_SEND_DOCUMENTS';

export interface AutomationDataField {
  key: string;
  label: string;
  type: AutomationFieldType;
  required: boolean;
  description: string;
  structure: 'SCALAR' | 'TABLE' | 'GROUP';
  source_hint: string;
  confidence_threshold: number;
  children: AutomationDataField[];
}

export interface AutomationCapability {
  key: string;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AutomationValidation {
  id: string;
  name: string;
  kind: 'DETERMINISTIC' | 'AI';
  condition: string;
  instruction: string;
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  action: 'FLAG' | 'HOLD_FOR_REVIEW' | 'REJECT';
  enabled: boolean;
}

export interface AutomationApprovalGate {
  id: string;
  name: string;
  trigger: string;
  assignee_type: 'ROLE' | 'MEMBER';
  approver_role: 'admin' | 'operator' | 'uploader';
  approver_user_ids: number[];
  fallback_role: 'admin' | 'operator' | 'uploader';
  action: 'REVIEW_AND_CORRECT' | 'APPROVE_OUTPUTS';
  enabled: boolean;
}

export interface AutomationOutputAction {
  id: string;
  type: 'DOCUMENT' | 'INTEGRATION' | 'RECORD' | 'NOTIFICATION';
  destination: string;
  action: string;
  enabled: boolean;
  config: Record<string, unknown>;
  mappings: Array<Record<string, unknown>>;
}

export interface AutomationConfig {
  schema_version: 2;
  template_key: AutomationTemplateKey;
  template_version: number;
  status: AutomationStatus;
  source: {
    sources: string[];
    whatsapp_mode?: string;
    whatsapp_bindings?: Array<{ connection_id: number; group_jid: string; group_name?: string | null }>;
    wechat_bindings?: Array<{ connection_id: number; group_id: string; group_name?: string | null }>;
    bundle_trigger?: string;
    bundle_expiry_minutes?: number;
  };
  data_contract: {
    document_types: string[];
    instructions: string;
    fields: AutomationDataField[];
  };
  knowledge: { required_types: string[]; source_ids: number[]; notes: string };
  capabilities: AutomationCapability[];
  validations: AutomationValidation[];
  approval: { mode: 'POLICY_BASED' | 'AUTO_PROCESS'; instructions: string; gates: AutomationApprovalGate[] };
  agent_output: {
    enabled: boolean;
    outcome_instruction: string;
    authority: 'PREPARE_ONLY' | 'AFTER_APPROVAL' | 'AUTO_WITHIN_POLICY';
    allowed_tools: AutomationAgentTool[];
    connection_ids: Record<string, number>;
    return_to_source: boolean;
    max_steps: number;
    stop_on_uncertainty: boolean;
  };
  outputs: AutomationOutputAction[];
  test: { status: string; last_run_at?: string | null };
}

export interface Automation {
  id: number;
  organization_id?: number | null;
  name: string;
  description?: string | null;
  template_key: AutomationTemplateKey;
  record_type: string;
  instructions?: string | null;
  approval_required: boolean;
  status: AutomationStatus;
  config: AutomationConfig;
  channels: Array<{ id: number; channel_type: string; channel_ref?: string | null; config: Record<string, unknown>; is_active: boolean }>;
  outputs: Array<{ id: number; output_type: string; sort_order: number; config: Record<string, unknown>; is_active: boolean }>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AutomationTemplate {
  key: AutomationTemplateKey;
  name: string;
  description: string;
  record_type: string;
  default_name: string;
  config: AutomationConfig;
}

export interface AutomationListResponse {
  items: Automation[];
  total: number;
  active: number;
  draft: number;
  paused: number;
}

export interface AutomationPlan {
  ready: boolean;
  steps: Array<{ stage: string; label: string; items: string[] }>;
  errors: string[];
  warnings: string[];
}

export interface AutomationFieldSuggestion {
  inferred_document_label: string;
  summary: string;
  fields: AutomationDataField[];
  workflow_steps: string[];
  knowledge_types: string[];
  capabilities: Array<Pick<AutomationCapability, 'key' | 'label' | 'enabled'>>;
  validations: AutomationValidation[];
  warnings: string[];
}

export interface AutomationApprovalSuggestion {
  summary: string;
  mode: 'POLICY_BASED' | 'AUTO_PROCESS';
  gates: AutomationApprovalGate[];
  warnings: string[];
}

export interface AutomationAgentPlan {
  run_id?: string | null;
  summary: string;
  authority: 'PREPARE_ONLY' | 'AFTER_APPROVAL' | 'AUTO_WITHIN_POLICY';
  steps: Array<{ sequence: number; tool: AutomationAgentTool; purpose: string; requires_approval: boolean; input_preview: Array<{ key: string; value: string }> }>;
  warnings: string[];
}

function normalizeApprovalGate(gate: AutomationApprovalGate): AutomationApprovalGate {
  const legacyRole = String(gate.approver_role || 'operator').toUpperCase();
  const approverRole = legacyRole === 'FINANCE_APPROVER' ? 'admin' :
    legacyRole === 'FINANCE_REVIEWER' || legacyRole === 'AR_REVIEWER' ? 'operator' :
      String(gate.approver_role || 'operator').toLowerCase();
  return {
    ...gate,
    assignee_type: gate.assignee_type || 'ROLE',
    approver_role: (['admin', 'operator', 'uploader'].includes(approverRole) ? approverRole : 'operator') as AutomationApprovalGate['approver_role'],
    approver_user_ids: Array.isArray(gate.approver_user_ids) ? gate.approver_user_ids : [],
    fallback_role: gate.fallback_role || 'admin',
  };
}

function normalizeAutomation(automation: Automation): Automation {
  const config = automation.config;
  return {
    ...automation,
    config: {
      ...config,
      source: { ...config.source, sources: Array.isArray(config.source?.sources) ? config.source.sources : [], whatsapp_bindings: config.source?.whatsapp_bindings || [], wechat_bindings: config.source?.wechat_bindings || [] },
      data_contract: { ...config.data_contract, document_types: config.data_contract?.document_types || [], fields: config.data_contract?.fields || [], instructions: config.data_contract?.instructions || '' },
      knowledge: { required_types: config.knowledge?.required_types || [], source_ids: config.knowledge?.source_ids || [], notes: config.knowledge?.notes || '' },
      capabilities: config.capabilities || [],
      validations: config.validations || [],
      approval: { mode: config.approval?.mode || 'POLICY_BASED', instructions: config.approval?.instructions || '', gates: (config.approval?.gates || []).map(normalizeApprovalGate) },
      agent_output: config.agent_output || { enabled: false, outcome_instruction: '', authority: 'AFTER_APPROVAL', allowed_tools: [], connection_ids: {}, return_to_source: true, max_steps: 12, stop_on_uncertainty: true },
      outputs: config.outputs || [],
      test: config.test || { status: 'NOT_RUN', last_run_at: null },
    },
  };
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Automation request failed');
  }
  return response.json();
}

export async function listAutomationTemplates(): Promise<AutomationTemplate[]> {
  const result = await handle<{ items: AutomationTemplate[] }>(await fetch(`${BASE_URL}/automations/templates`, { headers: getScopedHeaders() }));
  return result.items;
}

export async function suggestAutomationFields(input: {
  template_key: AutomationTemplateKey;
  instruction: string;
  sample_text?: string;
  existing_fields: AutomationDataField[];
  existing_knowledge_types: string[];
  existing_capabilities: AutomationCapability[];
  existing_validations: AutomationValidation[];
}): Promise<AutomationFieldSuggestion> {
  return handle<AutomationFieldSuggestion>(await fetch(`${BASE_URL}/automations/suggest-fields`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(input),
  }));
}

export async function suggestAutomationApproval(input: {
  template_key: AutomationTemplateKey;
  instruction: string;
  workflow_summary?: string;
  validations: AutomationValidation[];
  outputs: AutomationOutputAction[];
}): Promise<AutomationApprovalSuggestion> {
  const result = await handle<AutomationApprovalSuggestion>(await fetch(`${BASE_URL}/automations/suggest-approval`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(input),
  }));
  return { ...result, gates: result.gates.map(normalizeApprovalGate) };
}

export async function listAutomations(): Promise<AutomationListResponse> {
  const result = await handle<AutomationListResponse>(await fetch(`${BASE_URL}/automations`, { headers: getScopedHeaders() }));
  return { ...result, items: result.items.map(normalizeAutomation) };
}

export async function createAutomation(templateKey: AutomationTemplateKey, input?: { name?: string; description?: string }): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify({ name: input?.name || undefined, description: input?.description || undefined, template_key: templateKey }),
  })));
}

export async function getAutomation(id: number): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}`, { headers: getScopedHeaders() })));
}

export async function getAutomationPlan(id: number): Promise<AutomationPlan> {
  return handle<AutomationPlan>(await fetch(`${BASE_URL}/automations/${id}/plan`, { headers: getScopedHeaders() }));
}

export async function planAutomationAgentOutput(id: number, sampleData: Record<string, unknown>): Promise<AutomationAgentPlan> {
  return handle<AutomationAgentPlan>(await fetch(`${BASE_URL}/automations/${id}/agent-plan`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ sample_data: sampleData }),
  }));
}

export async function updateAutomation(id: number, update: Partial<Pick<Automation, 'name' | 'description' | 'instructions' | 'approval_required' | 'config'>>): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(update),
  })));
}

export async function activateAutomation(id: number): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}/activate`, { method: 'POST', headers: getScopedHeaders() })));
}

export async function pauseAutomation(id: number): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}/pause`, { method: 'POST', headers: getScopedHeaders() })));
}

export async function deleteAutomation(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/automations/${id}`, { method: 'DELETE', headers: getScopedHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Could not delete the automation.');
  }
}
