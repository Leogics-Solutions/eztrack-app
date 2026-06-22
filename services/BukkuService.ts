/**
 * Bukku Service
 * Configure and manage Bukku accounting integration per organization.
 */

import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

// --- Connection types ---

export interface BukkuConnection {
  id: number;
  user_id?: number;
  organization_id: number | null;
  company_subdomain: string;
  environment: string;
  base_url?: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface BukkuIntegration {
  enabled: boolean;
  connection_count: number;
  connections: BukkuConnection[];
}

export interface BukkuMappingCounts {
  account: number;
  contact: number;
  sale_invoice: number;
  purchase_bill: number;
}

export interface BukkuSyncLogSummary {
  id: number;
  status: string;
  started_at?: string;
  completed_at?: string | null;
  accounts_processed?: number;
  contacts_processed?: number;
  sales_invoices_processed?: number;
  purchase_bills_processed?: number;
}

export interface BukkuConnectionStatus {
  connection: BukkuConnection;
  mapping_counts: BukkuMappingCounts;
  ready_to_push_count: number;
  latest_sync: BukkuSyncLogSummary | null;
  latest_push: BukkuSyncLogSummary | null;
}

// --- Request / response types ---

export interface BukkuTestConnectionRequest {
  connection_id?: number;
  company_subdomain?: string;
  access_token?: string;
  environment?: string;
}

export interface BukkuTestConnectionResponse {
  status: 'success' | 'error';
  message: string;
  base_url?: string;
  company_subdomain?: string;
}

export interface BukkuSetupRequest {
  company_subdomain: string;
  access_token: string;
  environment: string;
  organization_id?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  sync_accounts?: boolean;
  sync_contacts?: boolean;
  sync_sales_invoices?: boolean;
  sync_purchase_bills?: boolean;
  page_size?: number;
}

export interface BukkuSetupSyncResult {
  sync_log_id: number;
  status: string;
  accounts_processed?: number;
  contacts_processed?: number;
  sales_invoices_processed?: number;
  purchase_bills_processed?: number;
}

export interface BukkuSetupResponse {
  connection: BukkuConnection;
  sync: BukkuSetupSyncResult;
}

export interface BukkuUpdateConnectionRequest {
  company_subdomain?: string;
  access_token?: string;
  environment?: string;
  organization_id?: number | null;
  is_active?: boolean;
}

export interface BukkuSyncRequest {
  connection_id: number;
  date_from?: string | null;
  date_to?: string | null;
  sync_accounts?: boolean;
  sync_contacts?: boolean;
  sync_sales_invoices?: boolean;
  sync_purchase_bills?: boolean;
  page_size?: number;
}

export interface BukkuSyncResponse {
  sync_log_id: number;
  status: string;
  accounts_processed?: number;
  contacts_processed?: number;
  sales_invoices_processed?: number;
  purchase_bills_processed?: number;
}

export interface BukkuDisableRequest {
  connection_id?: number;
}

export interface BukkuDisableResponse {
  message: string;
  connection_id?: number;
  disabled: boolean;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const error = await response.json().catch(() => ({ error: response.statusText }));
  throw new Error(error.message || error.error || error.detail || fallback);
}

/**
 * GET /bukku/connections
 */
export async function listBukkuConnections(): Promise<BukkuConnection[]> {
  const response = await fetch(`${BASE_URL}/bukku/connections`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to list Bukku connections');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.connections ?? [];
}

/**
 * GET /bukku/connections/{id}
 */
export async function getBukkuConnection(connectionId: number): Promise<BukkuConnection> {
  const response = await fetch(`${BASE_URL}/bukku/connections/${connectionId}`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to get Bukku connection');
  }
  return response.json();
}

/**
 * GET /bukku/connections/{id}/status
 */
export async function getBukkuConnectionStatus(
  connectionId: number
): Promise<BukkuConnectionStatus> {
  const response = await fetch(`${BASE_URL}/bukku/connections/${connectionId}/status`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to get Bukku connection status');
  }
  return response.json();
}

/**
 * POST /bukku/test-connection
 */
export async function testBukkuConnection(
  data: BukkuTestConnectionRequest
): Promise<BukkuTestConnectionResponse> {
  const response = await fetch(`${BASE_URL}/bukku/test-connection`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to test Bukku connection');
  }
  return response.json();
}

/**
 * POST /bukku/setup — validate, save, and run initial sync
 */
export async function setupBukku(data: BukkuSetupRequest): Promise<BukkuSetupResponse> {
  const response = await fetch(`${BASE_URL}/bukku/setup`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to set up Bukku integration');
  }
  return response.json();
}

/**
 * PUT /bukku/connections/{id}
 */
export async function updateBukkuConnection(
  connectionId: number,
  data: BukkuUpdateConnectionRequest
): Promise<BukkuConnection> {
  const response = await fetch(`${BASE_URL}/bukku/connections/${connectionId}`, {
    method: 'PUT',
    headers: getScopedHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to update Bukku connection');
  }
  return response.json();
}

/**
 * POST /bukku/disable — soft-disable
 */
export async function disableBukku(
  data?: BukkuDisableRequest
): Promise<BukkuDisableResponse> {
  const response = await fetch(`${BASE_URL}/bukku/disable`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(data ?? {}),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to disable Bukku integration');
  }
  return response.json();
}

/**
 * DELETE /bukku/connections/{id}
 */
export async function deleteBukkuConnection(connectionId: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/bukku/connections/${connectionId}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to delete Bukku connection');
  }
}

/**
 * POST /bukku/sync — re-import from Bukku
 */
export async function syncBukku(data: BukkuSyncRequest): Promise<BukkuSyncResponse> {
  const response = await fetch(`${BASE_URL}/bukku/sync`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to sync from Bukku');
  }
  return response.json();
}

/**
 * GET /bukku/sync-logs/{connection_id}
 */
export async function getBukkuSyncLogs(
  connectionId: number,
  limit = 50
): Promise<BukkuSyncLogSummary[]> {
  const response = await fetch(
    `${BASE_URL}/bukku/sync-logs/${connectionId}?limit=${limit}`,
    {
      method: 'GET',
      headers: getScopedHeaders(),
    }
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get Bukku sync logs');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.logs ?? [];
}
