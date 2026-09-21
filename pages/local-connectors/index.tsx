'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Monitor, ShieldCheck, RefreshCw, Link2, Search, Send, PauseCircle, X } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useOrganization } from '@/lib/OrganizationContext';
import { API_BASE_URL } from '@/services/config';
import {
  connectorCompanies, createConnectorCompany, createConnectorPairing, revokeConnector,
  connectorJobs, connectorPreview, enqueueConnectorInvoice, retryConnectorInvoice, cancelConnectorJob, closeConnectorReview,
  searchConnectorMasters,
  importConnectorMasters,
  canUseLocalConnectors,
  type ConnectorCompany, type ConnectorJob, type ConnectorMasterOption, type ConnectorPreview,
} from '@/services/LocalConnectorService';

const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`;
const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm';
const card = 'rounded-xl border border-[var(--border)] bg-[var(--card)] p-5';
const statusLabel = (value: string) => ({ leased: 'Preparing', processing: 'Entering in UBS', succeeded: 'Verified in UBS', needs_review: 'Needs review', review_closed: 'Review closed', queued: 'Queued', rejected: 'Rejected', cancelled: 'Cancelled' }[value] || value);
const errorLabel = (value: string) => ({
  local_validation_failed: 'The UBS form rejected the local values before saving.',
  source_invoice_deleted: 'The Smartdok invoice was deleted.',
  device_revoked: 'The connector laptop was replaced or revoked before entry began.',
  interrupted_entry: 'UBS entry was interrupted; check UBS before taking another action.',
}[value] || value.replaceAll('_', ' '));

function MatchBadge({ matched, ambiguous = false }: { matched: boolean; ambiguous?: boolean }) {
  if (matched) return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"><CheckCircle2 size={13} /> Auto matched</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"><AlertTriangle size={13} /> {ambiguous ? 'Choose a match' : 'Mapping required'}</span>;
}

function MasterPicker({ company, kind, value, placeholder, onChange, onSelect }:
  { company: string; kind: 'customer' | 'supplier' | 'item'; value: string; placeholder: string;
    onChange: (value: string) => void; onSelect: (master: ConnectorMasterOption) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ConnectorMasterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchConnectorMasters(company, kind, term).then(data => { if (active) setResults(data.masters); })
        .catch(() => { if (active) setResults([]); }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [company, kind, query]);

  return <div className="relative">
    <div className="relative"><Search className="absolute left-3 top-2.5 text-[var(--muted-foreground)]" size={16} />
      <input className={`${input} pl-9`} value={query} placeholder={placeholder} maxLength={100}
        onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
        onChange={event => { const next = event.target.value; setQuery(next); setOpen(true); onChange(next); }} />
    </div>
    {open && query.trim().length >= 2 && <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
      {loading && <div className="p-3 text-xs text-[var(--muted-foreground)]">Searching UBS masters…</div>}
      {!loading && results.map(master => <button type="button" key={master.code} className="block w-full border-b border-[var(--border)] px-3 py-2 text-left text-sm last:border-0 hover:bg-[var(--muted)]"
        onClick={() => { onSelect(master); setQuery(master.code); setResults([]); setOpen(false); }}>
        <span className="font-medium">{master.code}</span><span className="ml-2">{master.name || master.name2 || 'Unnamed UBS record'}</span>{master.uom && <span className="ml-2 text-xs text-[var(--muted-foreground)]">({master.uom})</span>}
      </button>)}
      {!loading && !results.length && <div className="p-3 text-xs text-[var(--muted-foreground)]">No UBS master found.</div>}
    </div>}
  </div>;
}

export default function LocalConnectorsPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const connectorAllowed = canUseLocalConnectors(selectedOrganizationId);
  const generation = useRef(0);
  const autoLoaded = useRef('');
  const [companies, setCompanies] = useState<ConnectorCompany[]>([]);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [jobs, setJobs] = useState<ConnectorJob[]>([]);
  const [pairing, setPairing] = useState<{ code: string; expires_at: string; company_name: string } | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [preview, setPreview] = useState<ConnectorPreview | null>(null);
  const [party, setParty] = useState('');
  const [partyEdited, setPartyEdited] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [retryJobId, setRetryJobId] = useState<string | null>(null);
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
  const partyCodeValid = /^\d{4}\/[A-Za-z0-9]{3}$/.test(party);

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
    autoLoaded.current = '';
    setCompanies([]); setSelected(''); setJobs([]); setPairing(null); setPreview(null); setParty(''); setPartyEdited(false); setReviewOpen(false); setRetryJobId(null); setError(''); setNotice(''); setBusy(false); setRole('');
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

  useEffect(() => {
    const routeInvoice = typeof router.query.invoice === 'string' && /^\d+$/.test(router.query.invoice) ? router.query.invoice : '';
    if (!routeInvoice || !selected || !canSend) return;
    const key = `${selected}:${routeInvoice}`;
    if (autoLoaded.current === key) return;
    autoLoaded.current = key;
    void loadInvoice(routeInvoice);
    // loadInvoice intentionally reads the latest selected connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.invoice, selected, canSend]);

  async function action(operation: (current: number) => Promise<void>) {
    const current = generation.current;
    setBusy(true); setError(''); setNotice('');
    try { await operation(current); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Connector action failed'); }
    finally { if (current === generation.current) setBusy(false); }
  }

  async function loadInvoice(requestedId = invoiceId, retryId: string | null = null) {
    await action(async current => {
      if (!/^\d+$/.test(requestedId)) throw new Error('Enter a valid Smartdok invoice ID');
      const data = await connectorPreview(Number(requestedId), selected);
      if (current === generation.current) {
        setInvoiceId(requestedId); setPreview(data); setParty(data.suggested_party_code || '');
        setPartyEdited(false); setRetryJobId(retryId); setReviewOpen(true);
      }
    });
  }

  function closeMappingReview() {
    setReviewOpen(false); setRetryJobId(null);
    if (router.query.invoice) void router.replace('/local-connectors', undefined, { shallow: true });
  }

  async function submitMapping() {
    if (!preview) return;
    await action(async current => {
      const mappings = preview.lines.map(({ line_id, item_code, uom }) => ({ line_id, item_code, uom }));
      const job = retryJobId
        ? await retryConnectorInvoice(retryJobId, preview.invoice_id, party, mappings)
        : await enqueueConnectorInvoice(selected, preview.invoice_id, party, mappings);
      if (current !== generation.current) return;
      setReviewOpen(false); setRetryJobId(null); setPreview(null);
      setNotice(`${job.invoice_no}: ${statusLabel(job.status)}. The connector will verify the saved UBS invoice before marking it complete.`);
      const data = await connectorJobs(selected);
      if (current === generation.current) setJobs(data.jobs);
      if (router.query.invoice) await router.replace('/local-connectors', undefined, { shallow: true });
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
          {company?.masters ? <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-900">
            <p className="font-medium">UBS masters synced</p>
            <p className="mt-1">{company.masters.counts.customer.toLocaleString()} customers · {company.masters.counts.supplier.toLocaleString()} suppliers · {company.masters.counts.item.toLocaleString()} items</p>
            <p className="mt-1">{new Date(company.masters.synced_at).toLocaleString()}</p>
          </div> : <p className="mt-4 text-xs text-amber-700">No UBS master list has been imported yet.</p>}
          {admin && selected && <label className={`${button} mt-3 cursor-pointer`}>
            Import UBS master ZIP<input className="sr-only" type="file" accept=".zip,application/zip" disabled={busy} onChange={event => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (!file) return;
              void action(async current => { const result = await importConnectorMasters(selected, file); if (current !== generation.current) return;
                setNotice(`Imported ${result.counts.customers.toLocaleString()} customers, ${result.counts.suppliers.toLocaleString()} suppliers and ${result.counts.items.toLocaleString()} items.`); await refresh(); });
            }} />
          </label>}
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
        {preview && !reviewOpen && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4">
          <div><Link className="font-medium text-blue-600" href={`/documents/${preview.invoice_id}`}>{preview.invoice_no || `Invoice ${preview.invoice_id}`}</Link><p className="text-sm text-[var(--muted-foreground)]">{preview.direction === 'AR' ? 'Sales invoice' : 'Supplier invoice'} · {preview.party_name} · {preview.currency} {Number(preview.total).toFixed(2)}</p></div>
          <button className={primary} onClick={() => setReviewOpen(true)}>Review UBS mappings</button>
        </div>}
      </section>
      <section className={card}>
        <div className="flex items-center gap-2 text-lg font-semibold"><PauseCircle size={20} /> Recent jobs</div>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">A needs-review job pauses later invoices for that laptop. Check UBS before closing its review. Closing a review does not resend the invoice.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)]"><th className="p-3">Invoice</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">UBS reference</th><th className="p-3">Action</th></tr></thead><tbody>
          {jobs.map(job => <tr key={job.id} className="border-b border-[var(--border)]"><td className="p-3">{job.invoice_id ? <Link className="text-blue-600" href={`/documents/${job.invoice_id}`}>{job.invoice_no}</Link> : <span>{job.invoice_no}</span>}<div className="text-xs text-[var(--muted-foreground)]">{new Date(job.created_at).toLocaleString()}{!job.invoice_id && ' · Smartdok invoice deleted'}</div></td><td className="p-3">RM {Number(job.total).toFixed(2)}</td><td className="p-3"><span className={job.status === 'succeeded' ? 'text-green-700' : job.status === 'needs_review' ? 'text-amber-700' : ''}>{statusLabel(job.status)}</span>{job.error_code && <div className="max-w-xs text-xs text-[var(--muted-foreground)]">{errorLabel(job.error_code)}</div>}</td><td className="p-3">{job.result?.ubs_reference || '—'}</td><td className="p-3"><div className="flex flex-wrap gap-2">{admin && ['queued', 'leased'].includes(job.status) && <button className={button} disabled={busy} onClick={() => void action(async current => { await cancelConnectorJob(job.id); const data = await connectorJobs(selected); if (current === generation.current) setJobs(data.jobs); })}>Cancel</button>}{canSend && job.can_retry && job.invoice_id && <button className={button} disabled={busy} onClick={() => void loadInvoice(String(job.invoice_id), job.id)}>Correct and retry</button>}{admin && job.status === 'needs_review' && <button className={button} disabled={busy} onClick={() => { if (window.confirm('Have you checked the invoice in UBS? Closing this review allows later jobs to proceed and will not resend this invoice.')) void action(async current => { await closeConnectorReview(job.id); const data = await connectorJobs(selected); if (current === generation.current) setJobs(data.jobs); }); }}>Close review</button>}</div></td></tr>)}
          {!jobs.length && <tr><td colSpan={5} className="p-8 text-center text-[var(--muted-foreground)]">No jobs for this company connection.</td></tr>}
        </tbody></table></div>
      </section>
      {reviewOpen && preview && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="mapping-review-title">
        <div className="my-auto w-full max-w-5xl rounded-xl bg-[var(--card)] shadow-2xl">
          <div className="flex items-start justify-between border-b border-[var(--border)] p-5">
            <div><h2 id="mapping-review-title" className="text-xl font-semibold">{retryJobId ? 'Correct and retry UBS mapping' : 'Review UBS mapping'}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Confirm exactly which UBS records will receive this invoice.</p></div>
            <button type="button" className={button} aria-label="Close mapping review" onClick={closeMappingReview}><X size={18} /></button>
          </div>
          <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5">
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            {!preview.masters_synced && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Import the UBS master ZIP before confirming mappings.</div>}
            <div className="flex flex-wrap justify-between gap-3 rounded-lg bg-[var(--muted)] p-4">
              <div><Link className="font-semibold text-blue-600" href={`/documents/${preview.invoice_id}`}>{preview.invoice_no || `Invoice ${preview.invoice_id}`}</Link>
                <p className="text-sm">{preview.direction === 'AR' ? 'Sales invoice' : 'Supplier invoice'} · {preview.party_name}</p></div>
              <div className="font-semibold">{preview.currency} {Number(preview.total).toFixed(2)}</div>
            </div>
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{preview.direction === 'AR' ? 'Customer' : 'Supplier'} mapping</h3><p className="text-sm text-[var(--muted-foreground)]">Smartdok: {preview.party_name || 'No party name'}</p></div>
                {partyEdited && party ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">Selected / entered</span> : <MatchBadge matched={preview.party_match.status === 'matched'} ambiguous={preview.party_match.status === 'ambiguous'} />}
              </div>
              <MasterPicker company={selected} kind={preview.direction === 'AR' ? 'customer' : 'supplier'} value={party}
                placeholder={`Search UBS ${preview.direction === 'AR' ? 'customer' : 'supplier'} code or name`}
                onChange={value => { setParty(value); setPartyEdited(true); }}
                onSelect={master => { setParty(master.code); setPartyEdited(true); }} />
              {party && !partyCodeValid && <span className="mt-1 block text-xs text-red-700">Use four digits, a slash and three characters, for example 3000/U01.</span>}
              {!party && <span className="mt-1 block text-xs text-amber-700">Choose the UBS {preview.direction === 'AR' ? 'customer' : 'supplier'} before queuing.</span>}
            </section>
            <section><h3 className="mb-2 font-semibold">Item mappings</h3>
              <div className="space-y-3">{preview.lines.map((line, index) => <div key={line.line_id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{index + 1}. {line.description}</p><p className="text-sm text-[var(--muted-foreground)]">Quantity {line.quantity} · {preview.currency} {Number(line.total).toFixed(2)}</p></div>
                  {line.mapping_status === 'manual' && line.item_code ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">Selected / entered</span> : <MatchBadge matched={line.mapping_status === 'matched'} ambiguous={line.mapping_status === 'ambiguous'} />}</div>
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                  <label className="text-sm">UBS item code or name<MasterPicker company={selected} kind="item" value={line.item_code} placeholder="Search UBS item code or name"
                    onChange={value => setPreview(current => current && ({ ...current, lines: current.lines.map((item, i) => i === index ? { ...item, item_code: value, mapping_status: 'manual' } : item) }))}
                    onSelect={master => setPreview(current => current && ({ ...current, lines: current.lines.map((item, i) => i === index ? { ...item, item_code: master.code, uom: master.uom || item.uom, matched_name: master.name || master.name2, mapping_status: 'manual' } : item) }))} /></label>
                  <label className="text-sm">UBS base unit<input className={`${input} mt-0`} value={line.uom} maxLength={12} onChange={event => setPreview(current => current && ({ ...current, lines: current.lines.map((item, i) => i === index ? { ...item, uom: event.target.value, mapping_status: 'manual' } : item) }))} /></label>
                </div>
                {line.matched_name && <p className="mt-2 text-xs text-[var(--muted-foreground)]">UBS master: {line.matched_name}</p>}
                {(!line.item_code || !line.uom) && <p className="mt-2 text-xs text-amber-700">Choose an item and base unit before queuing.</p>}
              </div>)}</div>
            </section>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-5">
            <p className="max-w-2xl text-xs text-[var(--muted-foreground)]">Rejected or cancelled jobs can be corrected and retried. Jobs that may have reached UBS require manual review and are never resent automatically.</p>
            <div className="flex gap-2"><button type="button" className={button} disabled={busy} onClick={closeMappingReview}>Cancel</button>
              <button type="button" className={primary} disabled={busy || !preview.masters_synced || !configured || !canSend || preview.status !== 'VALIDATED' || !partyCodeValid || preview.lines.length > 5 || !preview.lines.every(line => line.item_code && line.uom)} onClick={() => void submitMapping()}><Send size={16} /> {retryJobId ? 'Confirm retry' : `Queue for ${company?.name || 'UBS'}`}</button></div>
          </div>
        </div>
      </div>}
    </div>
  </AppLayout> : null}</ProtectedRoute>;
}
