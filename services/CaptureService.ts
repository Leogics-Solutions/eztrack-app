/**
 * Capture Hub API client.
 *
 * Filtering rules are deterministic and run before OCR/AI. Processing instructions
 * are organization-scoped guidance applied only after an item has been accepted.
 */

import { BASE_URL } from './config';
import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';

export type CaptureAction = 'ACCEPT' | 'FILTER';
export type ChannelInstructionSource = Exclude<CaptureSource, 'ALL'>;
export type CaptureSource =
  | 'ALL'
  | 'UPLOAD'
  | 'INBOUND_EMAIL'
  | 'GMAIL'
  | 'WHATSAPP'
  | 'DRIVE'
  | 'TELEGRAM';
export type CaptureRuleField = 'sender' | 'subject' | 'body' | 'filename' | 'source_type';
export type CaptureRuleOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'starts_with'
  | 'ends_with';

export interface CaptureRule {
  id: string;
  name: string;
  source_type: CaptureSource;
  field: CaptureRuleField;
  operator: CaptureRuleOperator;
  value: string;
  action: CaptureAction;
  priority: number;
  is_active: boolean;
}

export interface CaptureConfiguration {
  organization_id: number;
  default_action: CaptureAction;
  rules: CaptureRule[];
  processing_instructions: string;
  channel_processing_instructions: Partial<Record<ChannelInstructionSource, string>>;
  instruction_version: number;
  updated_at?: string | null;
}

export interface CaptureConfigurationUpdate {
  default_action?: CaptureAction;
  rules?: CaptureRule[];
  processing_instructions?: string;
  channel_processing_instructions?: Partial<Record<ChannelInstructionSource, string>>;
}

export interface CaptureAttachment {
  filename: string;
  content_type?: string | null;
  size_bytes?: number | null;
  external_id?: string | null;
}

export interface CaptureEvent {
  id: number;
  organization_id: number;
  source_type: Exclude<CaptureSource, 'ALL'> | string;
  connection_id?: number | null;
  external_id: string;
  sender?: string | null;
  recipients: string[];
  subject?: string | null;
  body_preview?: string | null;
  attachments: CaptureAttachment[];
  status: string;
  decision_reason?: string | null;
  matched_rule_id?: string | null;
  job_ids: string[];
  error_message?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaptureInboxResponse {
  items: CaptureEvent[];
  total: number;
  page: number;
  page_size: number;
}

export interface CaptureRuleTestInput {
  rule: CaptureRule;
  sender?: string;
  subject?: string;
  body?: string;
  filename?: string;
  source_type?: CaptureSource;
}

export interface CaptureRuleTestResult {
  matched: boolean;
  action?: CaptureAction | null;
  explanation: string;
}

export interface CapturePlaygroundResult {
  decision: {
    action: CaptureAction;
    reason: string;
    matched_rule_id?: string | null;
  };
  source_type: ChannelInstructionSource;
  global_instructions: string;
  channel_instructions: string;
  effective_instructions: string;
  attachment?: {
    filename: string;
    content_type?: string | null;
    size_bytes: number;
  } | null;
  ai_requested: boolean;
  ai_ran: boolean;
  pages_charged: number;
  extraction?: Record<string, unknown> | null;
  explanation: string;
}

export type IntegrationRequestChannel =
  | 'DEDICATED_EMAIL'
  | 'WHATSAPP_BUSINESS'
  | 'TELEGRAM';

export interface IntegrationSetupRequest {
  id: number;
  organization_id: number;
  requested_by?: number | null;
  channel: IntegrationRequestChannel;
  notes?: string | null;
  contact_email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type ChannelSyncType = 'GMAIL' | 'DRIVE';

export interface ChannelSyncSchedule {
  id: number;
  organization_id: number;
  user_id: number;
  channel_type: ChannelSyncType;
  connection_id: number;
  enabled: boolean;
  interval_minutes: number;
  gmail_label_ids: string[];
  gmail_only_unread: boolean;
  next_sync_at?: string | null;
  last_started_at?: string | null;
  last_completed_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelSyncScheduleUpdate {
  enabled: boolean;
  interval_minutes: 5 | 15 | 30 | 60;
  gmail_label_ids?: string[];
  gmail_only_unread?: boolean;
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || error.error || 'Capture request failed');
  }
  return response.json();
}

export async function getCaptureConfiguration(): Promise<CaptureConfiguration> {
  const response = await fetch(`${BASE_URL}/capture/configuration`, {
    headers: getScopedHeaders(),
  });
  return handle<CaptureConfiguration>(response);
}

export async function updateCaptureConfiguration(
  update: CaptureConfigurationUpdate
): Promise<CaptureConfiguration> {
  const response = await fetch(`${BASE_URL}/capture/configuration`, {
    method: 'PATCH',
    headers: getScopedHeaders(),
    body: JSON.stringify(update),
  });
  return handle<CaptureConfiguration>(response);
}

export async function testCaptureRule(
  input: CaptureRuleTestInput
): Promise<CaptureRuleTestResult> {
  const response = await fetch(`${BASE_URL}/capture/rules/test`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify({
      sender: '',
      subject: '',
      body: '',
      filename: '',
      source_type: 'GMAIL',
      ...input,
    }),
  });
  return handle<CaptureRuleTestResult>(response);
}

export async function runCapturePlayground(input: {
  source_type: ChannelInstructionSource;
  sender?: string;
  subject?: string;
  body?: string;
  filename?: string;
  run_ai?: boolean;
  attachment?: File | null;
}): Promise<CapturePlaygroundResult> {
  const form = new FormData();
  form.set('source_type', input.source_type);
  form.set('sender', input.sender || '');
  form.set('subject', input.subject || '');
  form.set('body', input.body || '');
  form.set('filename', input.filename || input.attachment?.name || '');
  form.set('run_ai', input.run_ai ? 'true' : 'false');
  if (input.attachment) form.set('attachment', input.attachment);

  const response = await fetch(`${BASE_URL}/capture/playground`, {
    method: 'POST',
    headers: getScopedHeadersForFormData(),
    body: form,
  });
  return handle<CapturePlaygroundResult>(response);
}

export async function listCaptureInbox(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  sourceType?: string;
  search?: string;
} = {}): Promise<CaptureInboxResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('page_size', String(params.pageSize || 100));
  if (params.status) query.set('status', params.status);
  if (params.sourceType) query.set('source_type', params.sourceType);
  if (params.search) query.set('search', params.search);

  const response = await fetch(`${BASE_URL}/capture/inbox?${query.toString()}`, {
    headers: getScopedHeaders(),
  });
  return handle<CaptureInboxResponse>(response);
}

export async function getCaptureEvent(eventId: number): Promise<CaptureEvent> {
  const response = await fetch(`${BASE_URL}/capture/inbox/${eventId}`, {
    headers: getScopedHeaders(),
  });
  return handle<CaptureEvent>(response);
}

export async function updateCaptureEventDecision(
  eventId: number,
  action: 'IGNORE' | 'RESTORE'
): Promise<CaptureEvent> {
  const response = await fetch(`${BASE_URL}/capture/inbox/${eventId}`, {
    method: 'PATCH',
    headers: getScopedHeaders(),
    body: JSON.stringify({ action }),
  });
  return handle<CaptureEvent>(response);
}

export async function listIntegrationSetupRequests(): Promise<IntegrationSetupRequest[]> {
  const response = await fetch(`${BASE_URL}/capture/integration-requests`, {
    headers: getScopedHeaders(),
  });
  return handle<IntegrationSetupRequest[]>(response);
}

export async function createIntegrationSetupRequest(input: {
  channel: IntegrationRequestChannel;
  notes?: string;
}): Promise<IntegrationSetupRequest> {
  const response = await fetch(`${BASE_URL}/capture/integration-requests`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(input),
  });
  return handle<IntegrationSetupRequest>(response);
}

export async function listChannelSyncSchedules(): Promise<ChannelSyncSchedule[]> {
  const response = await fetch(`${BASE_URL}/capture/sync-schedules`, {
    headers: getScopedHeaders(),
  });
  return handle<ChannelSyncSchedule[]>(response);
}

export async function updateChannelSyncSchedule(
  channelType: ChannelSyncType,
  connectionId: number,
  input: ChannelSyncScheduleUpdate
): Promise<ChannelSyncSchedule> {
  const response = await fetch(
    `${BASE_URL}/capture/sync-schedules/${channelType}/${connectionId}`,
    {
      method: 'PUT',
      headers: getScopedHeaders(),
      body: JSON.stringify(input),
    }
  );
  return handle<ChannelSyncSchedule>(response);
}
