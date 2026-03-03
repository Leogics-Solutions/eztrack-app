/**
 * Google Drive Service
 * Connect Google Drive for ingesting documents from folders (OAuth + sync)
 */

import { BASE_URL } from './config';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

// --- Connect (get Google login URL) ---
export interface DriveConnectResponse {
  auth_url: string;
  state: string;
}

/**
 * Start "Connect Google Drive" – get Google OAuth URL.
 * GET /api/v1/drive/connect
 * Redirect the user to auth_url; after approval, call postDriveCallback with code and state.
 */
export async function getDriveConnect(): Promise<DriveConnectResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/connect`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Drive connect URL');
  }

  return response.json();
}

// --- Callback (after user approved) ---
export interface DriveCallbackRequest {
  code: string;
  state: string;
}

export interface DriveCallbackResponse {
  message?: string;
  connected?: boolean;
}

/**
 * Finish connecting Google Drive after user approved.
 * POST /api/v1/drive/callback
 * Body: { code, state } from redirect query params.
 */
export async function postDriveCallback(data: DriveCallbackRequest): Promise<DriveCallbackResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to complete Drive connection');
  }

  return response.json();
}

// --- Sync (trigger ingestion from Drive) ---
export interface DriveSyncRequest {
  folder_ids?: string[];
  document_type?: string;
  max_files?: number;
  auto_classify?: boolean;
  remark?: string;
}

export interface DriveSyncResponse {
  sync_log_id?: number;
  status?: 'SUCCESS' | 'FAILED';
  files_processed?: number;
  files_ingested?: number;
  jobs_enqueued?: number;
  job_ids?: number[];
  error_message?: string | null;
  errors?: Array<{ message?: string; file?: string }>;
  message?: string;
}

/**
 * Trigger ingestion from Google Drive.
 * POST /api/v1/drive/sync
 * Returns job_ids; poll status at GET /api/v1/invoices/batch-jobs/{job_id}
 */
export async function postDriveSync(data?: DriveSyncRequest): Promise<DriveSyncResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data ?? {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to sync Drive');
  }

  return response.json();
}

// --- User Drive settings (folder IDs) ---

export interface DriveUserSettingsResponse {
  drive_default_folder_ids?: string[] | null;
}

export interface DriveUserSettingsUpdateRequest {
  drive_default_folder_ids?: string[];
}

/**
 * Get current user's Drive settings (folder IDs).
 * GET /api/v1/drive/settings
 */
export async function getDriveSettings(): Promise<DriveUserSettingsResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/settings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Drive settings');
  }

  return response.json();
}

/**
 * Update current user's Drive folder IDs.
 * PATCH /api/v1/drive/settings
 * Body: { drive_default_folder_ids: ["1a2b3c...", "anotherFolderId"] } or [] to clear.
 */
export async function patchDriveSettings(data: DriveUserSettingsUpdateRequest): Promise<DriveUserSettingsResponse> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update Drive settings');
  }

  return response.json();
}

// --- Drive connections and sync history ---

export interface DriveConnectionInfo {
  id: number;
  email?: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

/**
 * Get current user's Drive connections.
 * GET /api/v1/drive/connections
 */
export async function getDriveConnections(): Promise<{ connections: DriveConnectionInfo[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/connections`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Drive connections');
  }

  return response.json();
}

export interface DriveSyncLogEntry {
  id?: number;
  sync_type?: string;
  status?: string;
  files_processed?: number;
  files_ingested?: number;
  jobs_enqueued?: number;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
}

/**
 * Get sync history for a Drive connection.
 * GET /api/v1/drive/sync/logs/{connection_id}
 */
export async function getDriveSyncLogs(
  connectionId: number
): Promise<{ logs?: DriveSyncLogEntry[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/sync/logs/${connectionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get Drive sync logs');
  }

  return response.json();
}

// --- Disconnect ---

/**
 * Disconnect Google Drive for the current user.
 * DELETE /api/v1/drive/connections/{connection_id}
 * Returns 204 No Content on success.
 */
export async function deleteDriveConnection(connectionId: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('No access token found');

  const response = await fetch(`${BASE_URL}/drive/connections/${connectionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to disconnect Drive');
  }
}
