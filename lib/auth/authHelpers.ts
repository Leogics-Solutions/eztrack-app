/**
 * Authentication Helper Functions
 * Handles redirects to login page when authentication fails
 */

/**
 * Redirect to login page and clear auth tokens
 */
export function redirectToLogin(redirectPath?: string): void {
  if (typeof window === 'undefined') return;

  // Clear all auth tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  
  // Clear auth cookies
  document.cookie = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';

  // Build login URL with redirect path
  const loginUrl = new URL('/login', window.location.origin);
  if (redirectPath && redirectPath !== '/login') {
    loginUrl.searchParams.set('next', redirectPath);
  }

  // Redirect to login
  window.location.href = loginUrl.toString();
}

/**
 * Check if an error response indicates authentication failure
 */
export function isAuthError(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Handle authentication errors from API responses
 */
export function handleAuthError(status: number, redirectPath?: string): void {
  if (isAuthError(status)) {
    redirectToLogin(redirectPath);
  }
}













