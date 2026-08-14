import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getBillingPlans,
  getSubscription,
  openBillingPortal,
  startCheckout,
  type BillingInterval,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/services/StripeBillingService';

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getBillingPlans(), getSubscription()])
      .then(([planData, status]) => {
        setPlans(planData);
        setSubscription(status);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load billing'));
  }, []);

  async function checkout(plan: BillingPlan) {
    setBusy(plan.key);
    setError('');
    try {
      await startCheckout(plan.key, billingInterval);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start Checkout');
      setBusy('');
    }
  }

  async function portal() {
    setBusy('portal');
    setError('');
    try {
      await openBillingPortal();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open billing portal');
      setBusy('');
    }
  }

  return (
    <main>
      <Head><title>Billing · Smartdok.ai</title></Head>
      <section>
        <header>
          <div>
            <Link href="/settings">← Settings</Link>
            <h1>Billing and plans</h1>
            <p>Secure payment and subscription management are hosted by Stripe.</p>
          </div>
          {subscription?.subscription && (
            <button className="secondary" disabled={!!busy} onClick={portal}>
              {busy === 'portal' ? 'Opening…' : 'Manage billing'}
            </button>
          )}
        </header>

        {error && <div className="error">{error}</div>}
        {subscription?.subscription && (
          <div className="current">
            <strong>Current plan: {subscription.subscription.plan_key || 'Subscription'}</strong>
            <span>
              Status: {subscription.subscription.status}
              {subscription.subscription.cancel_at_period_end ? ' · Cancels at period end' : ''}
            </span>
            {subscription.subscription.current_period_end && (
              <span>Current period ends {new Date(subscription.subscription.current_period_end).toLocaleDateString()}</span>
            )}
          </div>
        )}
        {!subscription?.configured && (
          <div className="notice">
            Stripe is disabled until the administrator completes the production configuration checklist.
          </div>
        )}

        <div className="interval">
          <button
            className={billingInterval === 'monthly' ? 'selected' : ''}
            onClick={() => setBillingInterval('monthly')}
          >
            Monthly
          </button>
          <button
            className={billingInterval === 'annual' ? 'selected' : ''}
            onClick={() => setBillingInterval('annual')}
          >
            Annual
          </button>
        </div>

        <div className="plans">
          {plans.map((plan) => {
            const intervalAvailable = plan.billing_intervals[billingInterval];
            return (
              <article key={plan.key}>
                <p className="eyebrow">{plan.name}</p>
                <h2>{plan.name}</h2>
                <p>Pricing, included credits, and feature entitlements will appear after the commercial plan is configured.</p>
                <button
                  disabled={!intervalAvailable || !!busy || !!subscription?.subscription}
                  onClick={() => checkout(plan)}
                >
                  {!intervalAvailable
                    ? `${billingInterval === 'annual' ? 'Annual' : 'Monthly'} configuration pending`
                    : busy === plan.key
                      ? 'Redirecting…'
                      : subscription?.subscription
                        ? 'Use Manage billing'
                        : `Choose ${plan.name}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <style jsx>{`
        main{min-height:100vh;background:#f8fafc;padding:48px 20px;font-family:Inter,system-ui;color:#0f172a}
        section{max-width:1050px;margin:auto}
        header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
        header a{color:#2563eb;text-decoration:none}
        h1{font-size:38px;margin:18px 0 4px}
        header p,article p{color:#64748b;line-height:1.55}
        .interval{display:flex;gap:8px;margin-top:24px}
        .interval button{margin:0;background:white;color:#334155;border:1px solid #cbd5e1}
        .interval button.selected{background:#0f172a;color:white;border-color:#0f172a}
        .plans{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:20px}
        article{background:white;border:1px solid #e2e8f0;border-radius:18px;padding:25px;display:flex;flex-direction:column;min-height:280px}
        article h2{font-size:25px;margin:4px 0}
        .eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#2563eb}
        button{margin-top:auto;border:0;border-radius:10px;padding:12px 16px;background:#2563eb;color:white;font-weight:750;cursor:pointer}
        button:disabled{opacity:.5;cursor:not-allowed}
        .secondary{margin:0;background:white;color:#334155;border:1px solid #cbd5e1}
        .current,.notice,.error{display:flex;gap:14px;flex-wrap:wrap;margin-top:24px;padding:16px;border-radius:12px}
        .current{background:#ecfdf5}
        .notice{background:#fff7ed;color:#9a3412}
        .error{background:#fef2f2;color:#b91c1c}
        @media(max-width:900px){.plans{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:760px){.plans{grid-template-columns:1fr}header{display:block}.secondary{margin-top:15px}}
      `}</style>
    </main>
  );
}
