/**
 * API Helper Functions
 * Centralized error handling for API calls
 */

import { redirectToLogin, isAuthError } from '@/lib/auth/authHelpers';

/**
 * Wrapper for fetch that handles authentication errors
 * Automatically redirects to login on 401/403 responses
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, options);

  // Check for authentication errors
  if (isAuthError(response.status)) {
    // Get current path for redirect
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : undefined;
    redirectToLogin(currentPath);
    // Throw error to prevent further processing
    throw new Error('Authentication required');
  }

  return response;
}

/**
 * Check if we have a valid access token
 */
export function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('access_token');
  return !!token;
}

/**
 * Get access token or redirect to login
 */
export function getAccessTokenOrRedirect(): string {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access localStorage on server');
  }

  const token = localStorage.getItem('access_token');
  if (!token) {
    const currentPath = window.location.pathname;
    redirectToLogin(currentPath);
    throw new Error('No access token found');
  }

  return token;
}

/** localStorage key for the currently selected organization (multi-company context) */
export const SELECTED_ORGANIZATION_ID_KEY = 'selected_organization_id';

/**
 * Get the currently selected organization ID for scoped API requests.
 * When set, X-Organization-Id is sent; when null/absent, backend uses primary org or legacy scope.
 */
export function getSelectedOrganizationId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SELECTED_ORGANIZATION_ID_KEY);
  if (raw === null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Set the selected organization ID (persisted to localStorage).
 * Call this when the user switches company in the UI.
 */
export function setSelectedOrganizationId(organizationId: number | null): void {
  if (typeof window === 'undefined') return;
  if (organizationId === null) {
    localStorage.removeItem(SELECTED_ORGANIZATION_ID_KEY);
  } else {
    localStorage.setItem(SELECTED_ORGANIZATION_ID_KEY, String(organizationId));
  }
}

/**
 * Build headers for scoped API requests (dashboard, documents, invoices, COA, etc.).
 * Includes Authorization and, when set, X-Organization-Id.
 * Use for all endpoints that respect active organization context.
 */
export function getScopedHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) {
    throw new Error('No access token found');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const orgId = getSelectedOrganizationId();
  if (orgId !== null) {
    headers['X-Organization-Id'] = String(orgId);
  }
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}

/**
 * Headers for FormData/multipart requests (no Content-Type; browser sets it with boundary).
 * Use for upload endpoints that send FormData.
 */
export function getScopedHeadersForFormData(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) {
    throw new Error('No access token found');
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const orgId = getSelectedOrganizationId();
  if (orgId !== null) {
    headers['X-Organization-Id'] = String(orgId);
  }
  return headers;
}






























