import { BASE_URL } from './config';
import { getAccessToken, persistTokens } from './AuthService';

type ApiEnvelope<T> = { success: boolean; data: T; message: string };
export type OtpPurpose = 'signup' | 'login' | 'password_reset';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Request failed');
  return (payload as ApiEnvelope<T>).data;
}

export const requestEmailOtp = (email: string, purpose: OtpPurpose) =>
  request<{ expires_in: number; delivery: string; development_code?: string }>('/auth/email-otp/request', {
    method: 'POST', body: JSON.stringify({ email, purpose }),
  });

export const verifyEmailOtp = (email: string, purpose: OtpPurpose, code: string) =>
  request<{ authenticated: boolean; verification_token?: string; tokens?: TokenSet; onboarding?: OnboardingState }>('/auth/email-otp/verify', {
    method: 'POST', body: JSON.stringify({ email, purpose, code }),
  });

export interface TokenSet { access_token: string; refresh_token: string; token_type: string; expires_in: number }
export interface OnboardingState {
  status: string; completed: boolean; company_name?: string; industry?: string;
  monthly_document_volume?: string; accounting_system?: string; initial_workflow?: string;
  intake_channel?: string; selected_plan?: string;
}

export async function registerVerified(data: Record<string, unknown>) {
  const result = await request<{ user: unknown; tokens: TokenSet; onboarding: OnboardingState }>('/auth/register', {
    method: 'POST', body: JSON.stringify(data),
  });
  persistTokens(result.tokens);
  return result;
}

export async function googleSignIn(idToken: string) {
  const attribution = getAttribution();
  const result = await request<{ user: unknown; tokens: TokenSet; onboarding: OnboardingState }>('/auth/google', {
    method: 'POST', body: JSON.stringify({ id_token: idToken, ...attribution }),
  });
  persistTokens(result.tokens);
  return result;
}

export const resetPassword = (resetToken: string, newPassword: string) =>
  request<null>('/auth/password/reset', { method: 'POST', body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }) });

export const getOnboarding = () => request<OnboardingState>('/auth/onboarding', {
  headers: { Authorization: `Bearer ${getAccessToken()}` },
});

export const completeOnboarding = (data: Omit<OnboardingState, 'status' | 'completed'>) => request<OnboardingState>('/auth/onboarding', {
  method: 'PUT', headers: { Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify(data),
});

function browserId(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  let value = localStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
  return value;
}

export function getAttribution() {
  if (typeof window === 'undefined') return {};
  const query = new URLSearchParams(window.location.search);
  return {
    anonymous_id: browserId('smartdok_anonymous_id'),
    session_id: browserId('smartdok_session_id'),
    referral_source: document.referrer || undefined,
    utm_source: query.get('utm_source') || undefined,
    utm_medium: query.get('utm_medium') || undefined,
    utm_campaign: query.get('utm_campaign') || undefined,
  };
}

export async function trackProductEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  try {
    await request<null>('/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        event_name: eventName, path: window.location.pathname, referrer: document.referrer,
        properties, ...getAttribution(),
      }),
    });
  } catch { /* analytics must never block onboarding */ }
}

export interface SupportTicketInput {
  email: string; name?: string; subject: string; category: string; message: string; website?: string;
}

export const createSupportTicket = (data: SupportTicketInput) => request<{ ticket_number?: string; status: string }>('/support/tickets', {
  method: 'POST',
  headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
  body: JSON.stringify({ ...data, source: 'web_app', anonymous_id: browserId('smartdok_anonymous_id') }),
});
