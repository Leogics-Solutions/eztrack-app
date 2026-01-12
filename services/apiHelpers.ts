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












