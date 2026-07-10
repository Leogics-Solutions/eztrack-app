/**
 * Gmail Service
 * Connect Gmail for ingesting documents from inbox (OAuth + sync)
 */

import { BASE_URL } from './config';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

// --- Connect (get Google login URL) ---
export interface GmailConnectResponse {
  auth_url: string;
  state: string;
}

/**
 * Start "Connect Gmail" – get Google OAuth URL.
 * GET /api/v1/gmail/connect
 * Redirect the user to auth_url; after approval, call postGmailCallback with code and state.
 */
export async function getGmailConnect(): Promise<GmailConnectResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/connect`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Gmail connect URL');
  }

  return response.json();
}

// --- Callback (after user approved) ---
export interface GmailCallbackRequest {
  code: string;
  state: string;
}

export interface GmailCallbackResponse {
  message?: string;
  connected?: boolean;
}

/**
 * Finish connecting Gmail after user approved.
 * POST /api/v1/gmail/callback
 * Body: { code, state } from redirect query params.
 */
export async function postGmailCallback(data: GmailCallbackRequest): Promise<GmailCallbackResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to complete Gmail connection');
  }

  return response.json();
}

// --- Sync (trigger ingestion from Gmail) ---
export interface GmailSyncRequest {
  since_date?: string;
  label_ids?: string[];
  document_type?: string;
  max_messages?: number;
  only_unread?: boolean;
  auto_classify?: boolean;
  remark?: string;
  use_agentic_classification?: boolean;
  finance_only?: boolean;
  force_reprocess?: boolean;
}

export interface GmailSyncResponse {
  sync_log_id?: number;
  status?: 'SUCCESS' | 'FAILED';
  messages_processed?: number;
  messages_skipped?: number;
  messages_classified?: number;
  attachments_ingested?: number;
  attachments_skipped?: number;
  jobs_enqueued?: number;
  job_ids?: string[];
  error_message?: string | null;
  errors?: Array<{ message?: string; attachment?: string }>;
  message?: string;
}

export const DEFAULT_GMAIL_SYNC_REQUEST: GmailSyncRequest = {
  document_type: 'auto',
  remark: 'Manual Gmail sync',
  use_agentic_classification: true,
  finance_only: true,
  force_reprocess: false,
};

/**
 * Trigger ingestion from Gmail (sync inbox → ingest attachments).
 * POST /api/v1/gmail/sync
 * Returns job_ids; poll status at GET /api/v1/invoices/batch-jobs/{job_id}
 */
export async function postGmailSync(data?: GmailSyncRequest): Promise<GmailSyncResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data ?? {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to sync Gmail');
  }

  return response.json();
}

// --- Gmail connections and sync history ---

export interface GmailConnectionInfo {
  id: number;
  email: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

/**
 * Get current user's Gmail connections.
 * GET /api/v1/gmail/connections
 */
export async function getGmailConnections(): Promise<{ connections: GmailConnectionInfo[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/connections`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Gmail connections');
  }

  return response.json();
}

export interface GmailSyncLogEntry {
  id?: number;
  sync_type?: string;
  status?: string;
  messages_processed?: number;
  messages_skipped?: number;
  messages_classified?: number;
  attachments_ingested?: number;
  attachments_skipped?: number;
  jobs_enqueued?: number;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
}

/**
 * Get sync history for a Gmail connection.
 * GET /api/v1/gmail/sync/logs/{connection_id}
 */
export async function getGmailSyncLogs(
  connectionId: number
): Promise<{ logs?: GmailSyncLogEntry[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/sync/logs/${connectionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Gmail sync logs');
  }

  return response.json();
}

// --- Gmail ingestion history ---

export type GmailMessageStatus = 'QUEUED' | 'SKIPPED' | 'NO_ATTACHMENTS' | 'PENDING' | string;
export type GmailAttachmentStatus = 'QUEUED' | 'SKIPPED' | 'FAILED' | 'PENDING' | string;

export interface GmailHistoryAttachment {
  id: number;
  message_id: number;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: GmailAttachmentStatus;
  skip_reason: string | null;
  job_id: string | null;
  job_type: string | null;
  document_type: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GmailHistoryItem {
  id: number;
  connection_id: number;
  user_id: number;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_history_id: string | null;
  internal_date: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  snippet: string | null;
  classification_label: string | null;
  classification_confidence: number | null;
  classification_reason: string | null;
  ingest_decision: string | null;
  status: GmailMessageStatus;
  attachments_count: number;
  eligible_attachments_count: number;
  jobs_enqueued: number;
  error_message: string | null;
  last_seen_at: string | null;
  processed_at: string | null;
  attachments?: GmailHistoryAttachment[];
}

export interface GmailHistoryParams {
  limit?: number;
  connection_id?: number;
  status?: string;
  classification_label?: string;
}

export interface GmailHistoryClearParams {
  connection_id?: number;
  reset_sync_state?: boolean;
  include_sync_logs?: boolean;
}

export interface GmailHistoryClearResponse {
  message?: string;
  deleted_history_count?: number;
  deleted_attachment_count?: number;
  deleted_sync_log_count?: number;
  reset_connections_count?: number;
}

/**
 * Get classifier-first Gmail ingestion history.
 * GET /api/v1/gmail/history
 */
export async function getGmailHistory(
  params: GmailHistoryParams = {}
): Promise<{ items?: GmailHistoryItem[]; history?: GmailHistoryItem[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const queryString = query.toString();
  const response = await fetch(`${BASE_URL}/gmail/history${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Gmail ingestion history');
  }

  const data = await response.json();
  return Array.isArray(data) ? { items: data } : data;
}

/**
 * Clear Gmail ingestion history for testing.
 * DELETE /api/v1/gmail/history
 */
export async function deleteGmailHistory(
  params: GmailHistoryClearParams = {}
): Promise<GmailHistoryClearResponse | null> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const queryString = query.toString();
  const response = await fetch(`${BASE_URL}/gmail/history${queryString ? `?${queryString}` : ''}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to clear Gmail ingestion history');
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

// --- User Gmail settings (ingest keywords) ---

export interface GmailUserSettingsResponse {
  gmail_ingest_keywords?: string[] | null;
}

export interface GmailUserSettingsUpdateRequest {
  gmail_ingest_keywords?: string[];
}

/**
 * Get current user's Gmail settings (ingest keywords).
 * GET /api/v1/gmail/settings
 * Requires Gmail enabled for the account.
 */
export async function getGmailSettings(): Promise<GmailUserSettingsResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/settings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Gmail settings');
  }

  return response.json();
}

/**
 * Update current user's Gmail ingest keywords.
 * PATCH /api/v1/gmail/settings
 * Body: { gmail_ingest_keywords: ["invoice", "receipt"] } or [] to clear.
 */
export async function patchGmailSettings(data: GmailUserSettingsUpdateRequest): Promise<GmailUserSettingsResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update Gmail settings');
  }

  return response.json();
}

// --- Disconnect (user removes Gmail connection) ---

/**
 * Disconnect Gmail for the current user.
 * DELETE /api/v1/gmail/connections/{connection_id}
 * Returns 204 No Content on success.
 */
export async function deleteGmailConnection(connectionId: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/gmail/connections/${connectionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to disconnect Gmail');
  }
}
