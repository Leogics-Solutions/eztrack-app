import { BASE_URL } from './config';
import { getAccessToken } from './AuthService';

type Envelope<T> = { success: boolean; data: T; message: string };

async function billingRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('Please sign in to manage billing');
  const response = await fetch(`${BASE_URL}/billing${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Billing request failed');
  return (payload as Envelope<T>).data;
}

export type BillingInterval = 'monthly' | 'annual';
export interface BillingPlan {
  key: 'lite' | 'starter' | 'growth' | 'pro';
  name: string;
  available: boolean;
  billing_intervals: Record<BillingInterval, boolean>;
}
export interface SubscriptionStatus {
  configured: boolean;
  subscription: null | { plan_key?: string; status: string; cancel_at_period_end: boolean; current_period_end?: string | null };
}

export const getBillingPlans = () => billingRequest<BillingPlan[]>('/plans');
export const getSubscription = () => billingRequest<SubscriptionStatus>('/subscription');

export async function startCheckout(planKey: BillingPlan['key'], billingInterval: BillingInterval = 'monthly') {
  const result = await billingRequest<{ checkout_session_id: string; url: string }>('/checkout-session', {
    method: 'POST', body: JSON.stringify({ plan_key: planKey, billing_interval: billingInterval, idempotency_key: crypto.randomUUID() }),
  });
  window.location.assign(result.url);
}

export async function openBillingPortal() {
  const result = await billingRequest<{ url: string }>('/portal-session', {
    method: 'POST', body: JSON.stringify({ return_to_settings: true }),
  });
  window.location.assign(result.url);
}
