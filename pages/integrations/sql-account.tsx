'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Database, FlaskConical, LoaderCircle, Pencil, PlugZap, Plus, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  createSqlAccountConnection,
  deleteSqlAccountConnection,
  diagnoseSqlAccountCustomerPayment,
  getSqlAccountNumberSeries,
  listSqlAccountConnections,
  testSqlAccountConnection,
  updateSqlAccountConnection,
  saveSqlAccountNumberSeries,
  type SqlAccountConnection,
} from '@/services/SqlAccountService';

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15';
type PaymentMethodMapping = { code: string; label: string; bank_account: string; is_default: boolean };

export default function SqlAccountIntegrationPage() {
  const { selectedOrganizationId } = useOrganization();
  const [items, setItems] = useState<SqlAccountConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('Maincell SQL Accounting');
  const [apiUrl, setApiUrl] = useState('http://localhost:8787');
  const [apiKey, setApiKey] = useState('');
  const [company, setCompany] = useState('');
  const [doPrefix, setDoPrefix] = useState('DO-');
  const [doNextNumber, setDoNextNumber] = useState(1);
  const [doPadding, setDoPadding] = useState(5);
  const [invoicePrefix, setInvoicePrefix] = useState('IV-');
  const [invoiceNextNumber, setInvoiceNextNumber] = useState(1);
  const [invoicePadding, setInvoicePadding] = useState(5);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodMapping[]>([{ code: '', label: 'Bank transfer', bank_account: '', is_default: true }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await listSqlAccountConnections()).connections);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load SQL Accounting connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, selectedOrganizationId]);

  function resetForm() {
    setEditingId(null);
    setName('Maincell SQL Accounting');
    setApiUrl('http://localhost:8787');
    setApiKey('');
    setCompany('');
    setDoPrefix('DO-');
    setDoNextNumber(1);
    setDoPadding(5);
    setInvoicePrefix('IV-');
    setInvoiceNextNumber(1);
    setInvoicePadding(5);
    setPaymentMethods([{ code: '', label: 'Bank transfer', bank_account: '', is_default: true }]);
    setShowForm(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
    setError(null);
    setNotice(null);
  }

  async function openEdit(item: SqlAccountConnection) {
    setEditingId(item.id);
    setName(item.name);
    setApiUrl(item.api_url);
    setApiKey('');
    setCompany(item.company || '');
    setDoPrefix('DO-');
    setDoNextNumber(1);
    setDoPadding(5);
    setInvoicePrefix('IV-');
    setInvoiceNextNumber(1);
    setInvoicePadding(5);
    const configured = Array.isArray(item.config?.payment_methods) ? item.config.payment_methods as PaymentMethodMapping[] : [];
    setPaymentMethods(configured.length ? configured : [{ code: '', label: 'Bank transfer', bank_account: '', is_default: true }]);
    setShowForm(true);
    setError(null);
    setNotice(null);
    try {
      const numbering = await getSqlAccountNumberSeries(item.id);
      if (numbering) {
        setDoPrefix(numbering.delivery_order.prefix);
        setDoNextNumber(numbering.delivery_order.next_number);
        setDoPadding(numbering.delivery_order.padding);
        setInvoicePrefix(numbering.invoice.prefix);
        setInvoiceNextNumber(numbering.invoice.next_number);
        setInvoicePadding(numbering.invoice.padding);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load document numbering.');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const action = editingId === null ? 'create' : `edit-${editingId}`;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      let savedConnection: SqlAccountConnection;
      if (editingId === null) {
        savedConnection = await createSqlAccountConnection({
          name: name.trim(),
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
          company: company.trim() || undefined,
          config: { payment_methods: paymentMethods.filter((item) => item.code.trim()).map((item) => ({ ...item, code: item.code.trim(), label: item.label.trim(), bank_account: item.bank_account.trim() })) },
        });
      } else {
        const changes: { name: string; api_url: string; company: string; api_key?: string; config: Record<string, unknown> } = {
          name: name.trim(),
          api_url: apiUrl.trim(),
          company: company.trim(),
          config: { ...((items.find((item) => item.id === editingId)?.config || {})), payment_methods: paymentMethods.filter((item) => item.code.trim()).map((item) => ({ ...item, code: item.code.trim(), label: item.label.trim(), bank_account: item.bank_account.trim() })) },
        };
        if (apiKey.trim()) changes.api_key = apiKey.trim();
        savedConnection = await updateSqlAccountConnection(editingId, changes);
      }
      await saveSqlAccountNumberSeries(savedConnection.id, {
        delivery_order: { prefix: doPrefix.trim(), next_number: doNextNumber, padding: doPadding },
        invoice: { prefix: invoicePrefix.trim(), next_number: invoiceNextNumber, padding: invoicePadding },
      });
      resetForm();
      await load();
      setNotice('SQL Accounting connection and shared document numbering saved. Test it before assigning it to an automation.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save connection.');
    } finally {
      setBusy(null);
    }
  }

  async function test(item: SqlAccountConnection) {
    setBusy(`test-${item.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await testSqlAccountConnection(item.id);
      await load();
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connection test failed.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: SqlAccountConnection) {
    if (!window.confirm(`Remove ${item.name}? Automations using it must select another connection.`)) return;
    setBusy(`delete-${item.id}`);
    try {
      await deleteSqlAccountConnection(item.id);
      await load();
      setNotice('Connection removed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove connection.');
    } finally {
      setBusy(null);
    }
  }

  async function diagnose(item: SqlAccountConnection) {
    setBusy(`diagnose-${item.id}`); setError(null); setNotice(null);
    try {
      const result = await diagnoseSqlAccountCustomerPayment(item.id);
      const datasets = Array.isArray(result.datasets) ? result.datasets.length : 0;
      setNotice(`Customer Payment diagnostic passed without saving. ${datasets ? `${datasets} dataset(s) discovered.` : 'The connector returned its object metadata.'}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Customer Payment diagnostic failed.'); }
    finally { setBusy(null); }
  }

  const saving = busy === 'create' || busy === `edit-${editingId}`;

  return <AppLayout pageName="SQL Accounting">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Integrations</Link>
          <h1 className="mt-3 text-2xl font-bold">SQL Accounting connections</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">Connect Smartdok to the customer-side SQL Accounting SDK bridge. Automations receive only the tools you explicitly permit.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add connection</button>
      </header>

      {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">{notice}</div>}

      {showForm && <form onSubmit={save} className="rounded-2xl border border-cyan-300 bg-[var(--card)] p-5">
        <h2 className="font-semibold">{editingId === null ? 'New SDK bridge connection' : 'Edit SDK bridge connection'}</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">The bridge runs beside SQL Accounting and exposes a narrow authenticated API. Its secret is never returned to the browser after saving.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold">Connection name<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold">Company database / company<input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Optional" className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold">Bridge API URL<input required type="url" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold">Bridge API key {editingId !== null && <span className="font-normal text-[var(--muted-foreground)]">(leave blank to keep current key)</span>}<input required={editingId === null} minLength={apiKey ? 8 : undefined} type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={editingId === null ? '' : 'Current key is saved securely'} className={`${inputClass} mt-1`} /></label>
        </div>
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <h3 className="text-sm font-semibold">Document numbering for this accounting database</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Enter the next unused numbers shown in SQL Accounting. Every issuing company using this connection shares these counters, preventing duplicate document numbers.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold">DO prefix<input value={doPrefix} onChange={(event) => setDoPrefix(event.target.value)} className={`${inputClass} mt-1`} /></label>
            <label className="text-xs font-semibold">Next DO number<input required min={1} type="number" value={doNextNumber} onChange={(event) => setDoNextNumber(Math.max(1, Number(event.target.value) || 1))} className={`${inputClass} mt-1`} /></label>
            <label className="text-xs font-semibold">DO digits<input required min={1} max={12} type="number" value={doPadding} onChange={(event) => setDoPadding(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} className={`${inputClass} mt-1`} /></label>
            <label className="text-xs font-semibold">Invoice prefix<input value={invoicePrefix} onChange={(event) => setInvoicePrefix(event.target.value)} className={`${inputClass} mt-1`} /></label>
            <label className="text-xs font-semibold">Next invoice number<input required min={1} type="number" value={invoiceNextNumber} onChange={(event) => setInvoiceNextNumber(Math.max(1, Number(event.target.value) || 1))} className={`${inputClass} mt-1`} /></label>
            <label className="text-xs font-semibold">Invoice digits<input required min={1} max={12} type="number" value={invoicePadding} onChange={(event) => setInvoicePadding(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} className={`${inputClass} mt-1`} /></label>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Customer Payment bank mappings</h3><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Map a slip’s destination bank to an existing SQL Accounting payment-method code. At least one mapping is required before payment posting.</p></div><button type="button" onClick={() => setPaymentMethods((current) => [...current, { code: '', label: '', bank_account: '', is_default: false }])} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> Add</button></div>
          <div className="mt-3 space-y-2">{paymentMethods.map((method, index) => <div key={index} className="grid gap-2 rounded-lg bg-[var(--muted)]/40 p-3 sm:grid-cols-[1fr_1.2fr_1.2fr_auto_auto]">
            <input value={method.code} onChange={(event) => setPaymentMethods((current) => current.map((item, position) => position === index ? { ...item, code: event.target.value } : item))} placeholder="SQL code, e.g. BANK" className={inputClass} />
            <input value={method.label} onChange={(event) => setPaymentMethods((current) => current.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} placeholder="Label" className={inputClass} />
            <input value={method.bank_account} onChange={(event) => setPaymentMethods((current) => current.map((item, position) => position === index ? { ...item, bank_account: event.target.value } : item))} placeholder="Bank/account hint" className={inputClass} />
            <label className="flex items-center gap-2 px-2 text-xs font-semibold"><input type="radio" name="default-payment-method" checked={method.is_default} onChange={() => setPaymentMethods((current) => current.map((item, position) => ({ ...item, is_default: position === index })))} /> Default</label>
            <button type="button" onClick={() => setPaymentMethods((current) => current.filter((_, position) => position !== index))} className="rounded-lg p-2 text-red-700"><Trash2 className="h-4 w-4" /></button>
          </div>)}</div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={resetForm} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">Cancel</button>
          <button disabled={saving} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save connection'}</button>
        </div>
      </form>}

      {loading ? <div className="rounded-2xl border border-[var(--border)] p-12 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading connections…</div> : <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-xl bg-cyan-100 p-2.5 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"><Database className="h-5 w-5" /></span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.last_test_status === 'success' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}>{item.last_test_status === 'success' ? 'Connected' : 'Not tested'}</span>
          </div>
          <h2 className="mt-4 font-semibold">{item.name}</h2>
          <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{item.api_url}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.company || 'Default SQL Accounting company'}</p>
          {item.last_test_message && <p className="mt-3 rounded-lg bg-[var(--muted)] p-2 text-xs">{item.last_test_message}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void test(item)} disabled={busy === `test-${item.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{item.last_test_status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />} Test connection</button>
            <button type="button" aria-label={`Edit ${item.name}`} onClick={() => void openEdit(item)} className="rounded-lg border border-[var(--border)] px-3 text-[var(--foreground)] hover:bg-[var(--muted)]"><Pencil className="h-4 w-4" /></button>
            <button type="button" title="No-save Customer Payment diagnostic" onClick={() => void diagnose(item)} disabled={Boolean(busy)} className="rounded-lg border border-[var(--border)] px-3 text-[var(--foreground)] hover:bg-[var(--muted)]"><FlaskConical className={`h-4 w-4 ${busy === `diagnose-${item.id}` ? 'animate-pulse' : ''}`} /></button>
            <button type="button" aria-label={`Remove ${item.name}`} onClick={() => void remove(item)} disabled={busy === `delete-${item.id}`} className="rounded-lg border border-red-300 px-3 text-red-700 dark:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>
        </article>)}
        {items.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] p-12 text-center"><Database className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" /><p className="mt-3 font-semibold">No SQL Accounting connection yet</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Add the Maincell SDK bridge before enabling SQL tools in an automation.</p></div>}
      </div>}
    </div>
  </AppLayout>;
}
