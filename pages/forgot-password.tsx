import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { requestEmailOtp, resetPassword, verifyEmailOtp } from '@/services/SelfServiceService';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0); const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setError(''); try {
    if (step === 0) { await requestEmailOtp(email, 'password_reset'); setStep(1); }
    else if (step === 1) { const result = await verifyEmailOtp(email, 'password_reset', code); if (!result.verification_token) throw new Error('Verification failed'); setToken(result.verification_token); setStep(2); }
    else { await resetPassword(token, password); setDone(true); }
  } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); } }
  return <main><section><h1>Reset your password</h1><p>{done ? 'Your password has been updated.' : ['Enter the email on your Smartdok.ai account.', 'Enter the 6-digit code sent to your email.', 'Choose a new password with at least 8 characters.'][step]}</p>{error && <div className="error">{error}</div>}{done ? <Link href="/login">Return to sign in</Link> : <form onSubmit={submit}>{step === 0 && <input required type="email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} />}{step === 1 && <input required pattern="[0-9]{6}" maxLength={6} placeholder="Verification code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />}{step === 2 && <input required type="password" minLength={8} placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} />}<button>{['Send verification code','Verify code','Update password'][step]}</button></form>}<p><Link href="/login">Back to sign in</Link></p></section><style jsx>{`main{min-height:100vh;display:grid;place-items:center;background:#f8fafc;font-family:Inter,system-ui}section{width:min(90%,430px);background:#fff;padding:34px;border:1px solid #e2e8f0;border-radius:20px}form{display:grid;gap:12px}input,button{font:inherit;padding:13px;border-radius:10px}input{border:1px solid #cbd5e1}button{border:0;background:#2563eb;color:white;font-weight:700}.error{background:#fef2f2;color:#b91c1c;padding:10px;border-radius:8px}`}</style></main>;
}
