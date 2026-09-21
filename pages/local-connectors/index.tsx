'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Monitor, ShieldCheck, RefreshCw, Link2, Send, PauseCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useOrganization } from '@/lib/OrganizationContext';
import { API_BASE_URL } from '@/services/config';
import {
  connectorCompanies, createConnectorCompany, createConnectorPairing, revokeConnector,
  connectorJobs, connectorPreview, enqueueConnectorInvoice, cancelConnectorJob, closeConnectorReview,
  canUseLocalConnectors,
  type ConnectorCompany, type ConnectorJob, type ConnectorPreview,
} from '@/services/LocalConnectorService';

const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`;
const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm';
const card = 'rounded-xl border border-[var(--border)] bg-[var(--card)] p-5';
const statusLabel = (value: string) => ({ leased: 'Preparing', processing: 'Entering in UBS', succeeded: 'Verified in UBS', needs_review: 'Needs review', review_closed: 'Review closed', queued: 'Queued', rejected: 'Rejected', cancelled: 'Cancelled' }[value] || value);

export default function LocalConnectorsPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const connectorAllowed = canUseLocalConnectors(selectedOrganizationId);
  const generation = useRef(0);
  const [companies, setCompanies] = useState<ConnectorCompany[]>([]);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [jobs, setJobs] = useState<ConnectorJob[]>([]);
  const [pairing, setPairing] = useState<{ code: string; expires_at: string; company_name: string } | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [preview, setPreview] = useState<ConnectorPreview | null>(null);
  const [party, setParty] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const company = companies.find(c => c.id === selected);
  const admin = role === 'admin';
  const canSend = role === 'admin' || role === 'operator';
  const device = company?.device;
  const online = device?.last_seen_at && Date.now() - Date.parse(device.last_seen_at) < 90000;
  const paired = !!device && !device.revoked_at;
  const configured = paired && !!device.profile_hash;
  const download = process.env.NEXT_PUBLIC_CONNECTOR_INSTALLER_URL;
  const partyCodeValid = /^\d{4}\/[A-Z0-9]{3}$/.test(party);

  const refresh = useCallback(async () => {
    if (!connectorAllowed) return;
    const current = generation.current;
    try {
      const result = await connectorCompanies();
      if (current !== generation.current) return;
      setCompanies(result.companies); setRole(result.role);
      setSelected(old => result.companies.some(c => c.id === old) ? old : result.companies[0]?.id || '');
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : 'Unable to load connectors');
    }
  }, [connectorAllowed]);

  useEffect(() => {
    if (selectedOrganizationId !== null && !connectorAllowed) void router.replace('/');
  }, [connectorAllowed, selectedOrganizationId, router]);

  useEffect(() => {
    generation.current += 1;
    setCompanies([]); setSelected(''); setJobs([]); setPairing(null); setPreview(null); setParty(''); setError(''); setNotice(''); setBusy(false); setRole('');
    if (connectorAllowed) void refresh();
    return () => { generation.current += 1; };
  }, [selectedOrganizationId, connectorAllowed, refresh]);

  useEffect(() => {
    let active = true;
    setJobs([]); setPairing(null);
    if (!connectorAllowed || !selected) return;
    const load = async () => {
      try {
        const data = await connectorJobs(selected);
        if (active) setJobs(data.jobs);
        if (active) await refresh();
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load jobs');
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [selected, selectedOrganizationId, connectorAllowed, refresh]);

  useEffect(() => {
    if (typeof router.query.invoice === 'string' && /^\d+$/.test(router.query.invoice)) setInvoiceId(router.query.invoice);
  }, [router.query.invoice]);

  async function action(operation: (current: number) => Promise<void>) {
    const current = generation.current;
    setBusy(true); setError(''); setNotice('');
    try { await operation(current); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Connector action failed'); }
    finally { if (current === generation.current) setBusy(false); }
  }

  async function loadInvoice() {
    await action(async current => {
      if (!/^\d+$/.test(invoiceId)) throw new Error('Enter a valid Smartdok invoice ID');
      const data = await connectorPreview(Number(invoiceId));
      if (current === generation.current) { setPreview(data); setParty(''); }
    });
  }

  return <ProtectedRoute>{connectorAllowed ? <AppLayout pageName="Local connectors">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Local connectors</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Send reviewed invoices to UBS on your accounting laptop.</p></div>
        <button className={button} onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> Refresh</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={card}>
          <div className="mb-4 flex items-center gap-2 font-semibold"><Monitor size={20} /> 1. Select a UBS company</div>
          <label className="block text-sm">Company connection<select aria-label="Company connection" className={`${input} mt-2`} value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setPreview(null); setNotice(''); }}>
            <option value="">Choose a connection</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          {admin && <div className="mt-4 space-y-2"><label className="block text-sm">New connection name<input className={`${input} mt-2`} value={name} onChange={e => setName(e.target.value)} placeholder="ABC Sdn Bhd - UBS" maxLength={120} /></label>
            <button className={button} disabled={busy || !name.trim()} onClick={() => void action(async current => { const c = await createConnectorCompany(name.trim()); if (current !== generation.current) return; setName(''); await refresh(); setSelected(c.id); })}>Add company connection</button></div>}
          <p className="mt-4 text-xs text-[var(--muted-foreground)]">Each connection is assigned to one local UBS company and one active laptop.</p>
        </section>
        <section className={card}>
          <div className="mb-4 flex items-center gap-2 font-semibold"><Link2 size={20} /> 2. Pair the laptop</div>
          <p className="text-sm text-[var(--muted-foreground)]">Install Smartdok Connector on the UBS laptop, then enter this API address and a pairing code.</p>
          <div className="my-3 break-all rounded-lg bg-[var(--muted)] p-3 font-mono text-xs">{API_BASE_URL}</div>
          {download?.startsWith('https://') ? <a className={`${button} mb-3`} href={download} rel="noopener noreferrer">Download Windows installer</a> : <p className="mb-3 text-xs text-[var(--muted-foreground)]">Use the Windows installer supplied by Smartdok.</p>}
          {admin && <button className={primary} disabled={busy || !selected || paired} onClick={() => void action(async current => { const p = await createConnectorPairing(selected); if (current === generation.current) setPairing(p); })}>Generate pairing code</button>}
          {pairing && <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900"><p className="text-xs">For {pairing.company_name}</p><p className="my-2 break-all font-mono text-lg font-semibold">{pairing.code}</p><p className="text-xs">Single use. Expires {new Date(pairing.expires_at).toLocaleTimeString()}.</p></div>}
        </section>
        <section className={card}>
          <div className="mb-4 flex items-center gap-2 font-semibold"><ShieldCheck size={20} /> 3. Check readiness</div>
          <p className="font-medium">{paired ? device?.name : 'No paired laptop'}</p>
          <p className="mt-2 text-sm">{paired ? `${online ? 'Online' : 'Offline'} · ${device?.readiness.replaceAll('_', ' ')}` : 'Pair a laptop to continue.'}</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{configured ? device?.local_company_name : 'Configure and check the local UBS company in the connector app.'}</p>
          {device?.last_seen_at && <p className="mt-2 text-xs text-[var(--muted-foreground)]">Last seen {new Date(device.last_seen_at).toLocaleString()}</p>}
          <p className="mt-4 text-xs text-[var(--muted-foreground)]">An offline laptop keeps its invoices queued. UBS must be open and Windows unlocked to enter them.</p>
          {admin && paired && <button className={`${button} mt-4 text-red-700`} disabled={busy} onClick={() => {
            if (window.confirm('Revoke this laptop? Waiting jobs will be cancelled. An invoice already being entered may still finish and will require review.')) void action(async () => { await revokeConnector(device!.id); await refresh(); });
          }}>Revoke laptop access</button>}
        </section>
      </div>
      <section className={card}>
        <div className="flex items-center gap-2 text-lg font-semibold"><Send size={20} /> Send an invoice to UBS</div>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Validated MYR invoices, up to five lines, without tax, discounts or extra charges. Supplier invoices leave stock unchanged.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">Smartdok invoice ID<input className={`${input} mt-1 max-w-52`} inputMode="numeric" value={invoiceId} onChange={e => { setInvoiceId(e.target.value); setPreview(null); }} placeholder="Invoice ID" /></label>
          <button className={button} disabled={busy || !canSend} onClick={() => void loadInvoice()}>Load invoice</button></div>
        {preview && <div className="mt-5 space-y-4">
          <div className="flex flex-wrap justify-between gap-3"><div><Link className="font-medium text-blue-600" href={`/documents/${preview.invoice_id}`}>{preview.invoice_no || `Invoice ${preview.invoice_id}`}</Link><p className="text-sm text-[var(--muted-foreground)]">{preview.direction === 'AR' ? 'Sales invoice' : 'Supplier invoice'} · {preview.party_name} · {preview.status}</p></div><span className="font-semibold">{preview.currency} {Number(preview.total).toFixed(2)}</span></div>
          <label className="block max-w-sm text-sm">UBS {preview.direction === 'AR' ? 'customer' : 'supplier'} code<input className={`${input} mt-1`} value={party} onChange={e => setParty(e.target.value.toUpperCase())} placeholder={preview.direction === 'AR' ? '3000/U01' : '4000/W01'} maxLength={8} />
            {party && !partyCodeValid && <span className="mt-1 block text-xs text-red-700">Use four digits, a slash and three characters, for example 3000/U01.</span>}
          </label>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)]"><th className="p-2">Description</th><th className="p-2">Quantity</th><th className="p-2">UBS item code</th><th className="p-2">UBS base unit</th></tr></thead><tbody>{preview.lines.map((line, index) => <tr key={line.line_id} className="border-b border-[var(--border)]"><td className="p-2">{line.description}</td><td className="p-2">{line.quantity}</td><td className="p-2"><input aria-label={`UBS item code line ${index + 1}`} className={input} value={line.item_code} maxLength={24} onChange={e => setPreview(p => p && ({ ...p, lines: p.lines.map((x, i) => i === index ? { ...x, item_code: e.target.value } : x) }))} /></td><td className="p-2"><input aria-label={`UBS base unit line ${index + 1}`} className={input} value={line.uom} maxLength={12} onChange={e => setPreview(p => p && ({ ...p, lines: p.lines.map((x, i) => i === index ? { ...x, uom: e.target.value } : x) }))} /></td></tr>)}</tbody></table></div>
          <button className={primary} disabled={busy || !configured || !canSend || preview.status !== 'VALIDATED' || !partyCodeValid || preview.lines.length > 5 || !preview.lines.every(l => l.item_code && l.uom)} onClick={() => void action(async current => {
            const job = await enqueueConnectorInvoice(selected, preview.invoice_id, party, preview.lines.map(({ line_id, item_code, uom }) => ({ line_id, item_code, uom })));
            if (current !== generation.current) return;
            setNotice(`${preview.invoice_no}: ${statusLabel(job.status)}. The connector will verify the saved UBS invoice before marking it complete.`);
            const data = await connectorJobs(selected); if (current === generation.current) setJobs(data.jobs);
          })}><Send size={16} /> Queue for {company?.name || 'UBS'}</button>
        </div>}
      </section>
      <section className={card}>
        <div className="flex items-center gap-2 text-lg font-semibold"><PauseCircle size={20} /> Recent jobs</div>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">A needs-review job pauses later invoices for that laptop. Check UBS before closing its review. Closing a review does not resend the invoice.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)]"><th className="p-3">Invoice</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">UBS reference</th><th className="p-3">Action</th></tr></thead><tbody>
          {jobs.map(job => <tr key={job.id} className="border-b border-[var(--border)]"><td className="p-3"><Link className="text-blue-600" href={`/documents/${job.invoice_id}`}>{job.invoice_no}</Link><div className="text-xs text-[var(--muted-foreground)]">{new Date(job.created_at).toLocaleString()}</div></td><td className="p-3">RM {Number(job.total).toFixed(2)}</td><td className="p-3"><span className={job.status === 'succeeded' ? 'text-green-700' : job.status === 'needs_review' ? 'text-amber-700' : ''}>{statusLabel(job.status)}</span>{job.error_code && <div className="text-xs text-[var(--muted-foreground)]">{job.error_code.replaceAll('_', ' ')}</div>}</td><td className="p-3">{job.result?.ubs_reference || '—'}</td><td className="p-3">{admin && ['queued', 'leased'].includes(job.status) && <button className={button} disabled={busy} onClick={() => void action(async current => { await cancelConnectorJob(job.id); const data = await connectorJobs(selected); if (current === generation.current) setJobs(data.jobs); })}>Cancel</button>}{admin && job.status === 'needs_review' && <button className={button} disabled={busy} onClick={() => { if (window.confirm('Have you checked the invoice in UBS? Closing this review allows later jobs to proceed and will not resend this invoice.')) void action(async current => { await closeConnectorReview(job.id); const data = await connectorJobs(selected); if (current === generation.current) setJobs(data.jobs); }); }}>Close review</button>}</td></tr>)}
          {!jobs.length && <tr><td colSpan={5} className="p-8 text-center text-[var(--muted-foreground)]">No jobs for this company connection.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </AppLayout> : null}</ProtectedRoute>;
}
