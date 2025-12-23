/**
 * Creditor Accounts Service
 * Simple functions to call creditor account-related endpoints
 */

import { BASE_URL } from './config';

// Types
export interface CreditorAccount {
  id: number;
  name: string;
  code?: string | null;
  vendor_id?: number | null;
  vendor_name?: string;
  description?: string | null;
  is_active: boolean;
  invoice_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ListCreditorAccountsParams {
  skip?: number;
  limit?: number;
  active_only?: boolean;
}

export interface ListCreditorAccountsResponse {
  success: boolean;
  data: CreditorAccount[];
  message: string;
}

export interface CreateCreditorAccountRequest {
  name: string;
  code?: string;
  vendor_id?: number;
  description?: string;
}

export interface CreateCreditorAccountResponse {
  success: boolean;
  data: CreditorAccount;
  message: string;
}

export interface GetCreditorAccountResponse {
  success: boolean;
  data: CreditorAccount;
  message: string;
}

export interface UpdateCreditorAccountRequest {
  name?: string;
  code?: string;
  vendor_id?: number;
  description?: string;
  is_active?: boolean;
}

export interface UpdateCreditorAccountResponse {
  success: boolean;
  data: CreditorAccount;
  message: string;
}

export interface DeleteCreditorAccountResponse {
  success: boolean;
  data: null;
  message: string;
}

export interface CreditorAccountInvoice {
  id: number;
  invoice_no: string;
  invoice_date: string;
  vendor_name: string;
  vendor_id: number;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListCreditorAccountInvoicesParams {
  skip?: number;
  limit?: number;
}

export interface ListCreditorAccountInvoicesResponse {
  success: boolean;
  data: CreditorAccountInvoice[];
  message: string;
}

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * List all creditor accounts for the current user
 * GET /creditor-accounts
 */
export async function listCreditorAccounts(
  params?: ListCreditorAccountsParams
): Promise<ListCreditorAccountsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined) {
    queryParams.append('skip', params.skip.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.active_only !== undefined) {
    queryParams.append('active_only', params.active_only.toString());
  }

  const url = `${BASE_URL}/creditor-accounts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list creditor accounts');
  }

  return response.json();
}

/**
 * Create a new creditor account
 * POST /creditor-accounts
 */
export async function createCreditorAccount(
  data: CreateCreditorAccountRequest
): Promise<CreateCreditorAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/creditor-accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create creditor account');
  }

  return response.json();
}

/**
 * Get creditor account details by ID
 * GET /creditor-accounts/{account_id}
 */
export async function getCreditorAccount(
  accountId: number
): Promise<GetCreditorAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/creditor-accounts/${accountId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get creditor account');
  }

  return response.json();
}

/**
 * Update creditor account information
 * PUT /creditor-accounts/{account_id}
 */
export async function updateCreditorAccount(
  accountId: number,
  data: UpdateCreditorAccountRequest
): Promise<UpdateCreditorAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/creditor-accounts/${accountId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update creditor account');
  }

  return response.json();
}

/**
 * Delete a creditor account (soft delete)
 * DELETE /creditor-accounts/{account_id}
 */
export async function deleteCreditorAccount(
  accountId: number
): Promise<DeleteCreditorAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/creditor-accounts/${accountId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete creditor account');
  }

  return response.json();
}

/**
 * Get all invoices linked to a specific creditor account
 * GET /creditor-accounts/{account_id}/invoices
 */
export async function getCreditorAccountInvoices(
  accountId: number,
  params?: ListCreditorAccountInvoicesParams
): Promise<ListCreditorAccountInvoicesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined) {
    queryParams.append('skip', params.skip.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }

  const url = `${BASE_URL}/creditor-accounts/${accountId}/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get creditor account invoices');
  }

  return response.json();
}










