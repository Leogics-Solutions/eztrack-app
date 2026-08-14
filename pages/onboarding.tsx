import Head from 'next/head';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';
import { completeOnboarding, getOnboarding, trackProductEvent } from '@/services/SelfServiceService';

const choices = {
  monthly_document_volume: ['Under 100', '100–500', '501–2,000', 'More than 2,000'],
  accounting_system: ['SQL Account', 'Microsoft Business Central', 'Xero', 'Other / not yet connected'],
  initial_workflow: ['Order to invoice', 'Payment knock-off', 'Invoice capture', 'Bank reconciliation'],
  intake_channel: ['Web upload', 'Email', 'Google Drive', 'WhatsApp', 'WeChat'],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ company_name: '', industry: '', monthly_document_volume: '', accounting_system: '', initial_workflow: '', intake_channel: '', selected_plan: 'starter' });

  useEffect(() => {
    getOnboarding().then(data => {
      if (data.completed) { void router.replace('/'); return; }
      setForm(current => ({ ...current, ...Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string' && value)) }));
      void trackProductEvent('onboarding_started');
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not load onboarding')).finally(() => setBusy(false));
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (step < 2) { void trackProductEvent('onboarding_step_completed', { step }); setStep(step + 1); return; }
    setBusy(true);
    try { await completeOnboarding(form); await router.replace('/'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not finish setup'); setBusy(false); }
  }

  const select = (key: keyof typeof choices, label: string) => <fieldset><legend>{label}</legend><div className="options">{choices[key].map(value => <label className={form[key] === value ? 'selected' : ''} key={value}><input required type="radio" name={key} value={value} checked={form[key] === value} onChange={() => setForm({ ...form, [key]: value })} />{value}</label>)}</div></fieldset>;
  if (busy && !form.company_name) return <main className="shell"><p>Preparing your workspace…</p></main>;

  return <main className="shell"><Head><title>Set up Smartdok.ai</title></Head><section className="card">
    <div className="progress"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
    <p className="eyebrow">STEP {step + 1} OF 3</p>
    <h1>{['Tell us about your business', 'Choose your starting workflow', 'How will documents arrive?'][step]}</h1>
    <p className="sub">We use this to prepare sensible defaults. Everything can be changed later.</p>
    {error && <div className="error">{error}</div>}
    <form onSubmit={submit}>
      {step === 0 && <><label className="text">Company name<input required minLength={2} value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></label><label className="text">Industry<input required minLength={2} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></label>{select('monthly_document_volume', 'Documents per month')}</>}
      {step === 1 && <>{select('accounting_system', 'Accounting system')}{select('initial_workflow', 'First automation')}</>}
      {step === 2 && <>{select('intake_channel', 'Primary intake channel')}<p className="hint">You can connect additional email, Drive, WhatsApp, and WeChat channels from Settings after setup.</p></>}
      <div className="actions">{step > 0 && <button type="button" className="back" onClick={() => setStep(step - 1)}>Back</button>}<button disabled={busy}>{step === 2 ? 'Create my workspace' : 'Continue'}</button></div>
    </form>
  </section><style jsx>{`
    .shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;font-family:Inter,system-ui;color:#0f172a}.card{width:min(100%,680px);background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:38px;box-shadow:0 24px 70px #0f172a12}.progress{height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden}.progress span{display:block;height:100%;background:#2563eb;transition:width .2s}.eyebrow{color:#2563eb;font-size:12px;font-weight:800;letter-spacing:.12em;margin:26px 0 8px}h1{margin:0;font-size:30px}.sub,.hint{color:#64748b;line-height:1.55}.text{display:grid;gap:7px;font-size:13px;font-weight:700;margin:14px 0}.text input{padding:12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit}fieldset{border:0;padding:0;margin:22px 0}legend{font-weight:750;margin-bottom:10px}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.options label{border:1px solid #cbd5e1;border-radius:12px;padding:13px;cursor:pointer}.options label.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.options input{margin-right:8px}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}button{border:0;background:#2563eb;color:#fff;padding:12px 18px;border-radius:10px;font-weight:750;cursor:pointer}.back{background:#fff;color:#334155;border:1px solid #cbd5e1}.error{background:#fef2f2;color:#b91c1c;padding:11px;border-radius:9px}@media(max-width:600px){.options{grid-template-columns:1fr}.card{padding:25px}}
  `}</style></main>;
}
