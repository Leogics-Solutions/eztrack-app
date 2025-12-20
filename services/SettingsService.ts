/**
 * Settings Service
 * Functions to manage application settings including integration status
 */

import { BASE_URL } from './config';

// Types
export interface BusinessCentralConnection {
  id: number;
  environment: string;
  company_id: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export interface BusinessCentralIntegration {
  enabled: boolean;
  connection_count: number;
  connections: BusinessCentralConnection[];
}

export interface IntegrationSettings {
  business_central: BusinessCentralIntegration;
  xero?: {
    enabled: boolean;
    connection_count: number;
    connections: any[];
  };
  [key: string]: any; // Allow for other integrations
}

export interface UserInfo {
  id: number;
  email: string;
  full_name: string;
}

export interface SettingsResponse {
  integrations: IntegrationSettings;
  user: UserInfo;
}

// The API returns the settings directly, not wrapped
export type GetSettingsResponse = SettingsResponse;

// For backward compatibility and feature flags (if needed in future)
export interface UpdateSettingsRequest {
  business_central_enabled?: boolean;
  [key: string]: any; // Allow for other settings
}

export type UpdateSettingsResponse = SettingsResponse;

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Get application settings
 * GET /settings
 * Returns integration status and connection information
 */
export async function getSettings(): Promise<GetSettingsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/settings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get settings');
  }

  return response.json();
}

/**
 * Update application settings
 * PUT /settings
 */
export async function updateSettings(data: UpdateSettingsRequest): Promise<UpdateSettingsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update settings');
  }

  return response.json();
}

/**
 * Get Business Central integration enabled status
 * This is a convenience function that checks the settings
 * Note: enabled is true if at least one active connection exists
 */
export async function isBusinessCentralEnabled(): Promise<boolean> {
  try {
    const response = await getSettings();
    return response?.integrations?.business_central?.enabled ?? false;
  } catch (error) {
    console.error('Failed to check Business Central status:', error);
    return false;
  }
}

/**
 * Get Business Central connection count
 */
export async function getBusinessCentralConnectionCount(): Promise<number> {
  try {
    const response = await getSettings();
    return response?.integrations?.business_central?.connection_count ?? 0;
  } catch (error) {
    console.error('Failed to get Business Central connection count:', error);
    return 0;
  }
}

/**
 * Get Business Central connections
 */
export async function getBusinessCentralConnections(): Promise<BusinessCentralConnection[]> {
  try {
    const response = await getSettings();
    return response?.integrations?.business_central?.connections ?? [];
  } catch (error) {
    console.error('Failed to get Business Central connections:', error);
    return [];
  }
}

// Business Central Enable/Disable Types
export interface EnableBusinessCentralRequest {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  environment: string;
  company_id: string;
  organization_id?: number | null;
}

export interface EnableBusinessCentralResponse {
  id: number;
  user_id: number;
  organization_id: number | null;
  tenant_id: string;
  client_id: string;
  environment: string;
  company_id: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisableBusinessCentralRequest {
  connection_id?: number;
}

export interface DisableBusinessCentralResponse {
  message: string;
  connection_id?: number;
  disabled: boolean;
}

/**
 * Enable Business Central integration
 * POST /business-central/enable
 * Creates a new connection or updates an existing one
 */
export async function enableBusinessCentral(
  data: EnableBusinessCentralRequest
): Promise<EnableBusinessCentralResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/business-central/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to enable Business Central integration');
  }

  return response.json();
}

/**
 * Disable Business Central integration
 * POST /business-central/disable
 * Disables a specific connection or all connections
 */
export async function disableBusinessCentral(
  data?: DisableBusinessCentralRequest
): Promise<DisableBusinessCentralResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/business-central/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data || {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to disable Business Central integration');
  }

  return response.json();
}

// Test Connection Types
export interface TestConnectionRequest {
  connection_id?: number;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  environment?: string;
  company_id?: string;
}

export interface TestConnectionResponse {
  status: 'success' | 'error';
  message: string;
  company?: string;
  company_id?: string;
  available_companies?: Array<{
    id: string;
    name: string;
    systemVersion: string;
  }>;
}

/**
 * Test Business Central connection
 * POST /business-central/test-connection
 * Tests connection using connection_id or credentials directly
 */
export async function testBusinessCentralConnection(
  data: TestConnectionRequest
): Promise<TestConnectionResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/business-central/test-connection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to test Business Central connection');
  }

  return response.json();
}

// Push Invoices Types
export interface PushInvoicesRequest {
  connection_id: number;
  invoice_ids: number[];
}

export interface PushInvoiceDetail {
  invoice_id: number;
  invoice_no: string | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error_message: string | null;
  bc_invoice_id: string | null;
}

export interface PushInvoicesResponse {
  success_count: number;
  failed_count: number;
  skipped_count: number;
  details: PushInvoiceDetail[];
}

/**
 * Push invoices to Business Central
 * POST /business-central/push
 */
export async function pushInvoicesToBusinessCentral(
  data: PushInvoicesRequest
): Promise<PushInvoicesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/business-central/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to push invoices to Business Central');
  }

  return response.json();
}

