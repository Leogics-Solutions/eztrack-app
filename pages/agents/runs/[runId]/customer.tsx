'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { customerContext, previewCustomer, confirmCustomer, CustomerForm, CustomerContext, CustomerPreview, CustomerResult, SavedCustomer } from '@/services/CustomerMasterService';

const fields: { key: Exclude<keyof CustomerForm, 'address_lines'>; label: string; max: number }[] = [
  { key: 'company_name', label: 'Company name', max: 100 }, { key: 'registration_no', label: 'Reg. No (New)', max: 20 },
  { key: 'branch_name', label: 'Branch name', max: 100 }, { key: 'country', label: 'Country code (MY = Malaysia)', max: 2 },
  { key: 'postcode', label: 'PostCode', max: 10 }, { key: 'city', label: 'City', max: 50 }, { key: 'state', label: 'State', max: 50 },
  { key: 'attention', label: 'Attention', max: 100 }, { key: 'phone', label: 'Phone', max: 30 }, { key: 'mobile', label: 'Mobile', max: 30 },
  { key: 'email', label: 'Email', max: 100 }, { key: 'agent', label: 'Agent', max: 20 }, { key: 'tin', label: 'TIN (optional)', max: 14 },
];
const input = 'mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] p-2';
const button = 'rounded border border-[var(--border)] px-4 py-2 disabled:opacity-50';
function clean(form: CustomerForm): CustomerForm {
  return { ...form, country: ['MALAYSIA', 'MY'].includes(form.country.toUpperCase()) ? 'MY' : form.country,
    address_lines: [...form.address_lines] };
}
function Readback({ value }: { value: SavedCustomer }) {
  return <dl className="grid gap-3 sm:grid-cols-2">
    <div><dt>SQL customer code</dt><dd className="font-bold">{value.code}</dd></div>
    {fields.map(f => <div key={f.key}><dt className="text-sm opacity-70">{f.label}</dt><dd className="whitespace-pre-wrap">{value[f.key] || '—'}</dd></div>)}
    {value.address_lines.map((line, i) => <div key={i}><dt className="text-sm opacity-70">Address {i + 1}</dt><dd>{line || '—'}</dd></div>)}
    <div>Control A/C: {value.control_account}</div><div>Credit Terms: {value.credit_term}</div>
    <div>E-Invoice Submission: {value.submission_type === '17' ? 'E-Invoice' : value.submission_type}</div>
  </dl>;
}
export default function CustomerMaintenance() {
  const router = useRouter(); const runId = Number(router.query.runId);
  const [context, setContext] = useState<CustomerContext>(); const [form, setForm] = useState<CustomerForm>();
  const [operation, setOperation] = useState<'CREATE' | 'UPDATE'>('CREATE'); const [code, setCode] = useState('');
  const [search, setSearch] = useState(''); const [preview, setPreview] = useState<CustomerPreview>();
  const [result, setResult] = useState<CustomerResult>(); const [confirmed, setConfirmed] = useState(false);
  const [resume, setResume] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false); const serial = useRef(0);
  const load = useCallback(async (connectionId?: number, selectedCode = '', term = '') => {
    const n = ++serial.current; setBusy(true); setError('');
    try {
      const c = await customerContext(runId, connectionId, selectedCode, term);
      if (n !== serial.current) return;
      setContext(c); setConfirmed(false);
      const last = c.last_change;
      if (last && ['SAVING', 'UNKNOWN'].includes(last.status)) {
        setUncertain(true); setPreview({ ready: true, preview_id: last.id, plan: last.native_plan });
      } else {
        setUncertain(false);
        if (selectedCode && c.native?.customer) {
          setForm(clean(c.native.customer)); setCode(selectedCode); setOperation('UPDATE'); setPreview(undefined);
        } else if (last && ['PREVIEWED', 'REJECTED'].includes(last.status) && last.connection_id === c.connection_id && !term) {
          setForm(clean(last.native_plan.customer)); setOperation(last.native_plan.operation); setCode(last.native_plan.code);
          setPreview(last.status === 'PREVIEWED' ? { ready: true, preview_id: last.id, plan: last.native_plan } : undefined);
        } else if (!term) {
          setForm(clean(c.prefill)); setCode(''); setOperation('CREATE'); setPreview(undefined);
        }
      }
      if (last?.status === 'VERIFIED' && last.readback && last.connection_id === c.connection_id) setResult({ status: 'VERIFIED', readback: last.readback,
        resumed: false, confirmed_by: last.confirmed_by, confirmed_at: last.confirmed_at, resume_error: last.resume_error });
      else setResult(undefined);
    } catch (e) { if (n === serial.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (n === serial.current) setBusy(false); }
  }, [runId]);
  useEffect(() => { if (Number.isInteger(runId) && runId > 0) void load(); return () => { serial.current++; }; }, [runId, load]);
  function edit(key: keyof CustomerForm, value: string | string[]) {
    if (!form) return; setForm({ ...form, [key]: value }); setPreview(undefined); setConfirmed(false); setResult(undefined);
  }
  async function check() {
    if (!form || !context?.connection_id) return; setBusy(true); setError(''); setConfirmed(false); setResult(undefined);
    try { setPreview(await previewCustomer(runId, context.connection_id, operation, code, form)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!preview?.preview_id || (!uncertain && !confirmed)) return;
    const checkOnly = uncertain; setBusy(true); setError(''); setUncertain(true);
    try { const value = await confirmCustomer(runId, preview.preview_id, resume, checkOnly); setResult(value); setPreview(undefined); setUncertain(false); setConfirmed(false);
      setForm(clean(value.readback)); setCode(value.readback.code); setOperation('UPDATE'); }
    catch (e) { await load(context?.connection_id || undefined); setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <AppLayout pageName="Review"><main className="mx-auto max-w-5xl space-y-5 p-6">
    <Link href={`/review/${runId}`} className="underline">← Back to Review #{runId}</Link>
    <h1 className="text-2xl font-bold">Maintain SQL customer</h1>
    <p>Select the issuing company, complete the PO details, then preview and confirm the SQL change.</p>
    {error && <div role="alert" className="rounded border border-red-400 p-3 text-red-700">{error}</div>}
    <label className="block">Issuing company / SQL
      <select className={input} disabled={busy || uncertain} value={context?.connection_id || ''} onChange={e => void load(Number(e.target.value))}>
        <option value="">Choose company</option>{context?.companies.map(c => <option key={c.connection_id} value={c.connection_id}>{c.name}</option>)}
      </select>
    </label>
    {context?.connection_id && context.connection_id !== context.order_connection_id && <p role="alert" className="text-amber-700">This SQL company differs from the order’s issuer. The customer can be maintained here; this order will not resume automatically.</p>}
    {uncertain && <section className="rounded border border-amber-500 p-4"><p>The earlier customer save needs its SQL result checked. Keep this request until the saved result is verified.</p>
      <button className={button} disabled={busy} onClick={() => void save()}>Check saved result</button></section>}
    <fieldset disabled={busy || uncertain || !context?.connection_id} className="space-y-4 disabled:opacity-60">
      <div className="flex flex-wrap gap-2"><input aria-label="Search customer name or registration" className={input + ' max-w-md'} placeholder="Company name, registration or SQL code" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={button} onClick={() => void load(context?.connection_id || undefined, '', search)}>Find existing customer</button>
        <button className={button} onClick={() => { if (context) setForm(clean(context.prefill)); setOperation('CREATE'); setCode(''); setPreview(undefined); setResult(undefined); setConfirmed(false); }}>New customer from PO</button>
      </div>
      {!!context?.native?.matches.length && <ul className="space-y-2">{context.native.matches.map(c => <li key={c.CODE}><button className={button} onClick={() => void load(context?.connection_id || undefined, c.CODE)}>{c.CODE} · {c.COMPANYNAME} · {c.BRN2} {c.STATUS !== 'A' ? '(inactive)' : ''}</button></li>)}</ul>}
      {context?.native?.truncated && <p>More than 50 matches. Use a more specific name or registration.</p>}
      <h2 className="text-lg font-bold">{operation === 'UPDATE' ? `Edit existing customer ${code}` : 'Create a new customer'}</h2>
      <p className="text-sm">{operation === 'CREATE' ? 'New defaults: next 300-series company-initial code · Control A/C 300-000 · 30 Days · E-Invoice. Other SQL defaults are retained.' : 'Other customer settings and delivery branches are retained.'}</p>
      {form && <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(f => <label key={f.key}>{f.label}{f.key !== 'tin' ? ' *' : ''}
          <input className={input} required={f.key !== 'tin'} maxLength={f.max} type={f.key === 'email' ? 'email' : 'text'}
            list={f.key === 'agent' ? 'customer-agents' : undefined} value={form[f.key]} onChange={e => edit(f.key, e.target.value)} />
        </label>)}
        <datalist id="customer-agents">{context?.native?.agents.map(a => <option key={a.CODE} value={a.CODE}>{a.DESCRIPTION}</option>)}</datalist>
        {form.address_lines.map((line, i) => <label key={i}>Address {i + 1}{i === 0 ? ' *' : ''}<input className={input} maxLength={60} required={i === 0} value={line} onChange={e => edit('address_lines', form.address_lines.map((x, n) => n === i ? e.target.value : x))} /></label>)}
      </div>}
      <button className={button} onClick={() => void check()}>Check duplicates & preview without saving</button>
    </fieldset>
    {!!preview?.duplicates?.length && <section role="alert" className="rounded border border-amber-500 p-4"><h2 className="font-bold">Existing customer found — select it to review and edit</h2>
      {preview.duplicates.map(c => <button key={c.CODE} className={button} disabled={busy} onClick={() => void load(context?.connection_id || undefined, c.CODE)}>{c.CODE} · {c.COMPANYNAME} · {c.BRN2}</button>)}
    </section>}
    {preview?.ready && preview.plan && !uncertain && <section className="space-y-4 rounded border border-blue-400 p-4">
      <h2 className="text-xl font-bold">Confirm {preview.plan.operation === 'CREATE' ? 'new' : 'updated'} customer: {preview.plan.code}</h2>
      <p>No SQL Save has been called. Check every field below.</p>
      <table className="w-full text-left text-sm"><thead><tr><th>Field</th><th>Before</th><th>After confirmation</th></tr></thead><tbody>
        {fields.map(f => <tr key={f.key} className="border-t"><th className="py-2">{f.label}</th><td>{preview.plan?.before?.[f.key] || '—'}</td><td>{preview.plan?.customer[f.key] || '—'}</td></tr>)}
        {preview.plan.customer.address_lines.map((line, i) => <tr key={i} className="border-t"><th>Address {i + 1}</th><td>{preview.plan?.before?.address_lines[i] || '—'}</td><td>{line || '—'}</td></tr>)}
      </tbody></table>
      {context?.can_resume_order && context.connection_id === context.order_connection_id && <label className="block"><input type="checkbox" checked={resume} onChange={e => setResume(e.target.checked)} /> Resume this already approved order with the verified customer, after checking the original SQL result.</label>}
      <label className="block"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} /> I have checked the company, customer and all fields, and confirm this change in SQL.</label>
      <button className={button + ' bg-blue-700 text-white'} disabled={busy || !confirmed} onClick={() => void save()}>Confirm & save customer in SQL</button>
    </section>}
    {result?.status === 'VERIFIED' && <section className="space-y-4 rounded border border-green-600 p-4"><h2 className="text-xl font-bold">Saved and read back from SQL</h2>
      <p>Confirmed by user #{result.confirmed_by} · {result.confirmed_at ? new Date(result.confirmed_at).toLocaleString() : ''}</p>
      <Readback value={result.readback} />
      {result.resumed && <p>The already approved order has been queued for recovery. Return to Review to see its SQL and PDF result.</p>}
      {result.resume_error && <p role="alert" className="text-amber-700">Customer saved. Order remains pending: {result.resume_error}</p>}
      {result.note && <p>{result.note}</p>}
    </section>}
    {busy && <p role="status">Checking the selected SQL company…</p>}
  </main></AppLayout>;
}
