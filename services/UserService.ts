/**
 * User Service
 * Simple functions to call user-related endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:8000';
const API_VERSION = 'v1';
const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;

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

export interface QuotaData {
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  last_processed_at: string;
}

export interface GetUserQuotaResponse {
  success: boolean;
  data: QuotaData;
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

