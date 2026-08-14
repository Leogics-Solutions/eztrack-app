import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { getAttribution, googleSignIn, registerVerified, requestEmailOtp, trackProductEvent, verifyEmailOtp } from '@/services/SelfServiceService';

type Step = 'details' | 'verify';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({ full_name: '', company_name: '', email: '', password: '', industry: '' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { void trackProductEvent('signup_viewed'); }, []);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await requestEmailOtp(form.email, 'signup');
      setStep('verify');
      setNotice(response.development_code ? `Development code: ${response.development_code}` : `We sent a 6-digit code to ${form.email}.`);
      void trackProductEvent('signup_started');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send code'); }
    finally { setBusy(false); }
  }

  async function finish(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const verified = await verifyEmailOtp(form.email, 'signup', code);
      if (!verified.verification_token) throw new Error('Verification did not complete');
      await registerVerified({ ...form, verification_token: verified.verification_token, ...getAttribution() });
      await router.replace('/onboarding');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create account'); }
    finally { setBusy(false); }
  }

  const handleGoogle = useCallback(async (credential: string) => {
    setBusy(true); setError('');
    try {
      const result = await googleSignIn(credential);
      await router.replace(result.onboarding.completed ? '/' : '/onboarding');
    } catch (e) { setError(e instanceof Error ? e.message : 'Google sign-in failed'); }
    finally { setBusy(false); }
  }, [router]);

  return <main className="auth-shell">
    <Head><title>Create your Smartdok.ai account</title></Head>
    <section className="card">
      <Link href="/login" className="brand">Smartdok.ai</Link>
      <p className="eyebrow">SELF-SERVICE SETUP</p>
      <h1>{step === 'details' ? 'Start automating your documents' : 'Check your email'}</h1>
      <p className="sub">{step === 'details' ? 'Create your workspace in a few minutes. No sales call required.' : notice}</p>
      {error && <div className="error" role="alert">{error}</div>}
      {step === 'details' ? <>
        <GoogleSignInButton onCredential={handleGoogle} disabled={busy} />
        <div className="divider"><span>or use email</span></div>
        <form onSubmit={requestCode}>
          <label>Full name<input required minLength={2} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label>
          <label>Company name<input required minLength={2} value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></label>
          <label>Work email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label>Password<input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
          <label>Industry<input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Accounting, Retail" /></label>
          <button disabled={busy}>{busy ? 'Sending…' : 'Continue with email'}</button>
        </form>
      </> : <form onSubmit={finish}>
        <label>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <button disabled={busy || code.length !== 6}>{busy ? 'Creating workspace…' : 'Verify and create account'}</button>
        <button className="secondary" type="button" onClick={() => setStep('details')}>Change email</button>
      </form>}
      <p className="foot">Already have an account? <Link href="/login">Sign in</Link></p>
    </section>
    <style jsx>{`
      .auth-shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#dbeafe,#f8fafc 48%);font-family:Inter,system-ui;color:#0f172a}.card{width:min(100%,480px);background:white;border:1px solid #e2e8f0;border-radius:24px;padding:34px;box-shadow:0 24px 70px #0f172a18}.brand{font-weight:800;font-size:22px;color:#0f172a;text-decoration:none}.eyebrow{margin:28px 0 8px;color:#2563eb;font-size:12px;font-weight:800;letter-spacing:.14em}h1{font-size:30px;line-height:1.12;margin:0}.sub{color:#64748b;line-height:1.55}.divider{display:flex;align-items:center;gap:12px;margin:18px 0;color:#94a3b8;font-size:12px}.divider:before,.divider:after{content:'';height:1px;background:#e2e8f0;flex:1}form{display:grid;gap:14px}label{font-size:13px;font-weight:650;display:grid;gap:6px}input{font:inherit;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;outline:none}input:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb18}button{border:0;border-radius:10px;padding:13px 16px;background:#2563eb;color:white;font-weight:750;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.secondary{background:white;color:#334155;border:1px solid #cbd5e1}.error{padding:11px 13px;background:#fef2f2;color:#b91c1c;border-radius:9px;margin:14px 0;font-size:13px}.foot{text-align:center;color:#64748b;font-size:13px;margin:24px 0 0}.foot a{color:#2563eb}.sub:empty{display:none}
    `}</style>
  </main>;
}
