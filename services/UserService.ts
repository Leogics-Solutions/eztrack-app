/**
 * User Service
 * Simple functions to call user-related endpoints
 */

import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

// Types
export interface QuotaAllocation {
  allocation_id: number;
  billing_invoice_id: number | null;
  quota_pages: number;
  used_quota: number;
  used_quota_scope?: 'allocation_cumulative' | string;
  remaining_quota: number;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  allocated_at: string | null;
}

export interface InvoiceUsageItem {
  invoice_id: number;
  invoice_no: string | null;
  vendor_name: string | null;
  original_filename: string | null;
  used_quota: number;
  last_used_at: string | null;
}

export interface UsageBreakdown {
  invoice_usage: InvoiceUsageItem[];
  non_invoice_used_quota: number;
}

export interface UpdateUserRequest {
  full_name?: string;
  phone?: string;
  industry?: string;
}

export interface UpdateUserResponse {
  success: boolean;
  data: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    status: string;
    phone?: string;
    industry?: string;
  };
  message: string;
}

export interface PersonalQuota {
  unlimited?: boolean;
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  last_processed_at: string | null;
  allocations: QuotaAllocation[];
  usage_breakdown?: UsageBreakdown;
}

export interface OrganizationQuota {
  unlimited?: boolean;
  organization_id: number;
  organization_name: string;
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  allocations: QuotaAllocation[];
  usage_breakdown?: UsageBreakdown;
}

export interface EffectiveQuota {
  type: 'personal' | 'organization';
  unlimited?: boolean;
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  allocations: QuotaAllocation[];
}

export interface QuotaData {
  quota_enforcement_enabled?: boolean;
  quota_mode: 'personal' | 'organization';
  use_organization_quota: boolean;
  primary_organization_id: number | null;
  personal_quota: PersonalQuota;
  organization_quota?: OrganizationQuota;
  effective_quota: EffectiveQuota;
}

export interface OpenAIBillingSummary {
  status: 'available' | 'not_configured' | 'unavailable';
  period_start: string;
  period_end: string;
  currency: 'usd' | string;
  month_to_date_cost_usd: number | null;
  configured_budget_usd: number | null;
  configured_budget_remaining_usd: number | null;
  credit_balance_available: false;
  credit_balance_note: string;
  billing_dashboard_url: string;
  message: string;
}

export interface GetUserQuotaResponse {
  success: boolean;
  data: QuotaData;
  message: string;
}

// Legacy type for backward compatibility
export interface LegacyQuotaData {
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  last_processed_at: string;
}

export interface GetUserProfileResponse {
  success: boolean;
  data: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    status: string;
    phone?: string;
    industry?: string;
    invoice_quota_pages?: number;
  };
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
 * Get current user's profile information
 * GET /users/me
 */
export async function getCurrentUser(): Promise<GetUserProfileResponse> {
  const token = getAccessToken();

  if (!token) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      const { redirectToLogin } = await import('@/lib/auth/authHelpers');
      redirectToLogin(window.location.pathname);
    }
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/users/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // Check for auth errors and redirect
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const { redirectToLogin } = await import('@/lib/auth/authHelpers');
        redirectToLogin(window.location.pathname);
      }
    }
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get user information');
  }

  return response.json();
}

/**
 * Update current user's profile information
 * PUT /users/me
 */
export async function updateCurrentUser(data: UpdateUserRequest): Promise<UpdateUserResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/users/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update user');
  }

  return response.json();
}

/**
 * Get current user's quota information
 * GET /users/me/quota
 */
export async function getUserQuota(): Promise<GetUserQuotaResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/users/me/quota`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get quota information');
  }

  return response.json();
}

export async function getOpenAIBillingSummary(): Promise<{ success: boolean; data: OpenAIBillingSummary; message: string }> {
  const response = await fetch(`${BASE_URL}/users/me/openai-billing`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Failed to get OpenAI billing information');
  }

  return response.json();
}
