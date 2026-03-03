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
}

export interface GmailSyncResponse {
  sync_log_id?: number;
  status?: 'SUCCESS' | 'FAILED';
  messages_processed?: number;
  attachments_ingested?: number;
  jobs_enqueued?: number;
  job_ids?: number[];
  error_message?: string | null;
  errors?: Array<{ message?: string; attachment?: string }>;
  message?: string;
}

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
  attachments_ingested?: number;
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
