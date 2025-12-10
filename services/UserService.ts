/**
 * User Service
 * Simple functions to call user-related endpoints
 */

import { BASE_URL } from './config';

// Types
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
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  last_processed_at: string | null;
}

export interface OrganizationQuota {
  organization_id: number;
  organization_name: string;
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
}

export interface EffectiveQuota {
  type: 'personal' | 'organization';
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
}

export interface QuotaData {
  quota_mode: 'personal' | 'organization';
  use_organization_quota: boolean;
  primary_organization_id: number | null;
  personal_quota: PersonalQuota;
  organization_quota?: OrganizationQuota;
  effective_quota: EffectiveQuota;
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

