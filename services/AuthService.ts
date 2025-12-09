/**
 * Authentication Service
 * Simple functions to call authentication endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:8000';
const API_VERSION = 'v1';
const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;

// Types
export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  industry: string;
}

export interface RegisterResponse {
  success: boolean;
  data: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    status: string;
  };
  message: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  message: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  phone?: string;
  industry?: string;
  invoice_quota_pages?: number;
}

export interface GetCurrentUserResponse {
  success: boolean;
  data: User;
  message: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  data: null;
  message: string;
}

/**
 * Register a new user account
 * POST /auth/register
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Registration failed');
  }

  return response.json();
}

/**
 * Login and receive access tokens
 * POST /auth/login
 * Uses form data (application/x-www-form-urlencoded)
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Login failed');
  }

  const result = await response.json();

  // Store tokens after successful login
  if (result.success && result.data && typeof window !== 'undefined') {
    localStorage.setItem('access_token', result.data.access_token);
    localStorage.setItem('refresh_token', result.data.refresh_token);
  }

  return result;
}

/**
 * Get information about the currently authenticated user
 * GET /auth/me
 */
export async function getCurrentUser(): Promise<GetCurrentUserResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/auth/me`, {
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
 * Change the current user's password
 * POST /auth/change-password
 */
export async function changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to change password');
  }

  return response.json();
}

/**
 * Logout - clear tokens
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}
