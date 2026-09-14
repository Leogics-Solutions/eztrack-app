'use client';

import { AppLayout } from '@/components/layout';
import { formatMalaysiaDateTime } from '@/lib/dateTime';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  deleteCollectionImport,
  downloadCollectionSoa,
  importCollectionAgeing,
  listCollectionImports,
  reviewCollectionCase,
  type CollectionCase,
  type CollectionImport,
} from '@/services/CollectionService';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Mail, PauseCircle, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const money = (value: number, currency = 'MYR') => new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(value);
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function reviewTone(status: CollectionCase['review_status']) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (status === 'PAUSED') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  if (status === 'HELD') return 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100';
  return 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100';
}

export default function CollectionsPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<CollectionImport[]>([]);
  const [activeId, setActiveId] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeImport = imports.find((item) => item.id === activeId) || imports[0];
  const selectedCase = activeImport?.cases.find((item) => item.customer_code === selectedCode) || activeImport?.cases[0];
  const approvedCount = activeImport?.cases.filter((item) => item.review_status === 'APPROVED').length || 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listCollectionImports();
      setImports(items);
      const requestedImport = typeof router.query.import === 'string' ? router.query.import : '';
      const nextImport = items.find((item) => item.id === requestedImport) || items[0];
      setActiveId(nextImport?.id || '');
      const requestedCase = typeof router.query.case === 'string' ? router.query.case : '';
      setSelectedCode(nextImport?.cases.some((item) => item.customer_code === requestedCase) ? requestedCase : nextImport?.cases[0]?.customer_code || '');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load collection work.');
    } finally {
      setLoading(false);
    }
  }, [router.query.case, router.query.import]);

  useEffect(() => { if (router.isReady) void load(); }, [load, router.isReady, selectedOrganizationId]);

  const uploadFile = async (file?: File) => {
    if (!file) return;
    setBusy('upload');
    setError('');
    setNotice('');
    try {
      const result = await importCollectionAgeing(file);
      setImports((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      setActiveId(result.id);
      setSelectedCode(result.cases[0]?.customer_code || '');
      setNotice(`${result.customer_count} customer accounts processed from ${result.source_filename}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not process the ageing export.');
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const review = async (action: 'APPROVE' | 'HOLD') => {
    if (!activeImport || !selectedCase) return;
    setBusy(action.toLowerCase());
    setError('');
    try {
      const updated = await reviewCollectionCase(activeImport.id, selectedCase.customer_code, action, note);
      setImports((current) => current.map((item) => item.id !== activeImport.id ? item : {
        ...item,
        pending_approval_count: item.cases.filter((entry) => entry.customer_code !== updated.customer_code && entry.review_status === 'PENDING_APPROVAL').length,
        cases: item.cases.map((entry) => entry.customer_code === updated.customer_code ? updated : entry),
      }));
      setNote('');
      setNotice(action === 'APPROVE' ? 'Output approved and retained for controlled delivery.' : 'Collection action placed on hold.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the collection case.');
    } finally {
      setBusy('');
    }
  };

  const removeImport = async () => {
    if (!activeImport || !window.confirm(`Remove ${activeImport.source_filename} and all of its collection cases?`)) return;
    setBusy('delete');
    try {
      await deleteCollectionImport(activeImport.id);
      const remaining = imports.filter((item) => item.id !== activeImport.id);
      setImports(remaining);
      setActiveId(remaining[0]?.id || '');
      setSelectedCode(remaining[0]?.cases[0]?.customer_code || '');
      setNotice('Import removed. You can upload the file again for a clean run.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove the import.');
    } finally {
      setBusy('');
    }
  };

  return (
    <AppLayout pageName="SOA & collections">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Accounts receivable operations</p>
            <h1 className="mt-1 text-2xl font-bold">SOA & collection follow-up</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Import open receivables, generate customer Statements of Account, apply the collection policy, and review every customer-facing action.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/automations" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--muted)]">Workflow settings</Link>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"><Upload className="h-4 w-4" /> Import QNE ageing</button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void uploadFile(event.target.files?.[0])} />
          </div>
        </header>

        <section className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:grid-cols-3">
          {[['1', 'Data in', 'QNE open-AR ageing CSV'], ['2', 'Smartdok', 'Recalculate, group and apply policy'], ['3', 'Human control', 'Approve, hold or track exceptions']].map(([step, title, detail]) => <div key={step} className="flex items-center gap-3 rounded-lg p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">{step}</span><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-[var(--muted-foreground)]">{detail}</p></div></div>)}
        </section>

        {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">{notice}</div>}

        {loading ? <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-16 text-center"><LoaderCircle className="mx-auto h-7 w-7 animate-spin text-cyan-700" /><p className="mt-3 text-sm text-[var(--muted-foreground)]">Loading collection worklist…</p></div> : !activeImport ? (
          <section onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFile(event.dataTransfer.files[0]); }} className={`rounded-2xl border-2 border-dashed p-12 text-center transition ${dragging ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-950/30' : 'border-[var(--border)] bg-[var(--card)]'}`}>
            {busy === 'upload' ? <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-cyan-700" /> : <FileSpreadsheet className="mx-auto h-10 w-10 text-cyan-700" />}
            <h2 className="mt-4 text-lg font-bold">Import the QNE receivables ageing export</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">Drop the CSV here or choose it from your computer. Smartdok creates the collection worklist and SOA drafts from the actual rows in the file.</p>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy === 'upload'} className="mt-5 rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === 'upload' ? 'Processing…' : 'Choose ageing CSV'}</button>
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-sm font-semibold">Current import: {activeImport.source_filename}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Statement date {activeImport.statement_date} · Imported {formatMalaysiaDateTime(activeImport.created_at)}</p></div>
              <div className="flex flex-wrap gap-2">
                {imports.length > 1 && <select value={activeImport.id} onChange={(event) => { const item = imports.find((entry) => entry.id === event.target.value); setActiveId(event.target.value); setSelectedCode(item?.cases[0]?.customer_code || ''); }} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">{imports.map((item) => <option key={item.id} value={item.id}>{item.source_filename} · {item.statement_date}</option>)}</select>}
                <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Refresh</button>
                <button type="button" onClick={() => void removeImport()} disabled={busy === 'delete'} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"><Trash2 className="h-4 w-4" /> Remove import</button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Open receivables" value={money(activeImport.total_outstanding)} />
              <Metric label="Customer accounts" value={String(activeImport.customer_count)} />
              <Metric label="Awaiting approval" value={String(activeImport.cases.filter((item) => item.review_status === 'PENDING_APPROVAL').length)} />
              <Metric label="Approved outputs" value={String(approvedCount)} success={approvedCount > 0} />
            </section>

            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className="h-fit overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="border-b border-[var(--border)] p-4"><h2 className="font-semibold">Collection worklist</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Select a customer to review its SOA and next action.</p></div>
                <div className="divide-y divide-[var(--border)]">{activeImport.cases.map((item) => <button key={item.customer_code} type="button" onClick={() => setSelectedCode(item.customer_code)} className={`w-full p-4 text-left transition hover:bg-[var(--muted)] ${selectedCase?.customer_code === item.customer_code ? 'bg-cyan-50 dark:bg-cyan-950/30' : ''}`}><div className="flex items-start justify-between gap-2"><p className="font-semibold">{item.customer}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${reviewTone(item.review_status)}`}>{humanize(item.review_status)}</span></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.customer_code} · {item.oldest_days_overdue} days overdue</p><div className="mt-2 flex items-center justify-between text-sm"><span>{item.next_action}</span><strong>{money(item.total_outstanding, item.currency)}</strong></div></button>)}</div>
              </section>

              {selectedCase && <div className="space-y-5">
                <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
                  <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--muted)] p-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Statement of Account</p><h2 className="mt-1 text-lg font-bold">{selectedCase.customer}</h2><p className="text-xs text-[var(--muted-foreground)]">{selectedCase.customer_code} · {selectedCase.customer_email || 'No approved contact'} · {selectedCase.payment_terms}</p></div><div className="text-left sm:text-right"><p className="text-xs text-[var(--muted-foreground)]">As at {selectedCase.statement_date}</p><p className="text-xl font-bold">{money(selectedCase.total_outstanding, selectedCase.currency)}</p></div></div>
                  <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]"><th className="p-3">Invoice</th><th className="p-3">Invoice date</th><th className="p-3">Due date</th><th className="p-3">Overdue</th><th className="p-3 text-right">Original</th><th className="p-3 text-right">Outstanding</th></tr></thead><tbody>{selectedCase.invoices.map((invoice) => <tr key={invoice.invoice_number} className="border-b border-[var(--border)] last:border-0"><td className="p-3 font-semibold">{invoice.invoice_number}</td><td className="p-3">{invoice.invoice_date}</td><td className="p-3">{invoice.due_date}</td><td className="p-3">{invoice.days_overdue} days</td><td className="p-3 text-right">{money(invoice.original_amount, invoice.currency)}</td><td className="p-3 text-right font-semibold">{money(invoice.outstanding_amount, invoice.currency)}</td></tr>)}</tbody></table></div>
                  <div className="flex justify-end border-t border-[var(--border)] p-4"><button type="button" onClick={() => void downloadCollectionSoa(activeImport.id, selectedCase.customer_code)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" /> Download SOA PDF</button></div>
                </section>

                <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Policy decision</p><h2 className="mt-1 font-bold">{selectedCase.next_action}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{humanize(selectedCase.stage)} · oldest item {selectedCase.oldest_days_overdue} days overdue</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${reviewTone(selectedCase.review_status)}`}>{humanize(selectedCase.review_status)}</span></div>
                  {selectedCase.pause_reason ? <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><PauseCircle className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Routine collection paused</p><p className="mt-1 text-sm">{selectedCase.pause_reason}</p></div></div> : <div className="mt-4 rounded-lg border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100"><div className="flex items-center gap-2"><Mail className="h-4 w-4" /><p className="font-semibold">Prepared customer message</p></div><p className="mt-3 text-sm"><strong>To:</strong> {selectedCase.customer_email}</p><p className="mt-1 text-sm"><strong>Subject:</strong> {selectedCase.draft_subject}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{selectedCase.draft_body}</p></div>}
                  {selectedCase.review_status === 'PENDING_APPROVAL' && <div className="mt-4"><label className="text-xs font-semibold">Reviewer note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm font-normal" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void review('APPROVE')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === 'approve' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Approve controlled output</button><button type="button" onClick={() => void review('HOLD')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-lg border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-800 disabled:opacity-60 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> Place on hold</button></div></div>}
                  {selectedCase.review_status === 'APPROVED' && <div className="mt-4 flex gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Approved for controlled delivery</p><p className="mt-1 text-sm">Approved by {selectedCase.reviewed_by} at {formatMalaysiaDateTime(selectedCase.reviewed_at)}. Email delivery remains disabled until a production channel is approved.</p></div></div>}
                </section>
              </div>}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, success = false }: { label: string; value: string; success?: boolean }) {
  return <div className={`rounded-xl border p-4 ${success ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-[var(--border)] bg-[var(--card)]'}`}><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
