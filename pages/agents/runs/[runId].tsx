'use client';

import { AppLayout } from '@/components/layout';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, CheckCircle2, AlertTriangle, FileText, Send, Download, FileSpreadsheet, Image as ImageIcon, LoaderCircle, Trash2, Plus } from 'lucide-react';
import {
  getRun, getRunSource, reviewRun, generateRun, approveRun, sendRunToWhatsApp, repushRunToSqlAccount, createSqlAccountCustomerAndRepush, createSqlAccountItemsAndRepush, rejectRun,
  type AgentRun, type AgentRunData, type AgentRunForex, type AgentRunLine, type SqlAccountCustomerProposal, type SqlAccountStockItemProposal,
} from '@/services/AgentsService';

const fmt = (n?: number | null) => (n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const numeric = (value: string) => (value === '' ? null : Number(value));

export default function AgentRunPage() {
  const router = useRouter();
  const runId = Number(router.query.runId);

  const [run, setRun] = useState<AgentRun | null>(null);
  const [lines, setLines] = useState<AgentRunLine[]>([]);
  const [forexDraft, setForexDraft] = useState<AgentRunForex | null>(null);
  const [customerDraft, setCustomerDraft] = useState('');
  const [customerCodeDraft, setCustomerCodeDraft] = useState('');
  const [customerAddressDraft, setCustomerAddressDraft] = useState('');
  const [customerAttnDraft, setCustomerAttnDraft] = useState('');
  const [customerPhoneDraft, setCustomerPhoneDraft] = useState('');
  const [customerEmailDraft, setCustomerEmailDraft] = useState('');
  const [documentCodeDraft, setDocumentCodeDraft] = useState('');
  const [invoiceDateDraft, setInvoiceDateDraft] = useState('');
  const [noConversion, setNoConversion] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const busy = pending !== null;
  const [error, setError] = useState<string | null>(null);
  const [customerProposal, setCustomerProposal] = useState<SqlAccountCustomerProposal | null>(null);
  const [itemProposals, setItemProposals] = useState<SqlAccountStockItemProposal[]>([]);

  const hydrate = (r: AgentRun) => {
    setRun(r);
    const reviewed = r.corrected_data || r.extracted_data;
    setLines((reviewed?.lines || []).map((line) => ({ ...line })));
    setForexDraft(reviewed?.forex ? { ...reviewed.forex } : null);
    setCustomerDraft(reviewed?.customer || '');
    setCustomerCodeDraft(reviewed?.customer_code || '');
    setCustomerAddressDraft(reviewed?.customer_address || '');
    setCustomerAttnDraft(reviewed?.customer_attn || '');
    setCustomerPhoneDraft(reviewed?.customer_phone || '');
    setCustomerEmailDraft(reviewed?.customer_email || '');
    setDocumentCodeDraft(reviewed?.code || '');
    setInvoiceDateDraft(reviewed?.inv_date || '');
    setNoConversion(Boolean(reviewed?.no_conversion));
    const proposal = (r.output_refs as { sql_account?: { customer_proposal?: SqlAccountCustomerProposal } } | undefined)?.sql_account?.customer_proposal;
    setCustomerProposal(proposal?.code && proposal.code.length <= 10 && proposal.company_name ? { code: proposal.code, company_name: proposal.company_name, address: proposal.address || '' } : null);
    setItemProposals((r.output_refs as { sql_account?: { item_proposals?: SqlAccountStockItemProposal[] } } | undefined)?.sql_account?.item_proposals || []);
  };

  const load = useCallback(async (silent = false) => {
    if (!runId) return;
    if (!silent) setLoading(true);
    try {
      hydrate(await getRun(runId));
      setError(null);
    } catch (e) {
      if (!silent) setError((e as Error)?.message || 'Failed to load run');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  // While the agent is still reading the document, poll quietly so the page shows
  // live progress and flips to the review form the moment extraction finishes —
  // rather than blocking on one long request for a large (900+ item) order.
  useEffect(() => {
    const s = run?.status;
    if (s !== 'RECEIVED' && s !== 'EXTRACTING') return;
    const id = setInterval(() => { load(true); }, 3000);
    return () => clearInterval(id);
  }, [run?.status, load]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!runId || !run?.source_file_s3_key) {
      setSourceUrl(null);
      return undefined;
    }

    setSourceError(null);
    getRunSource(runId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSourceMime(blob.type);
        setSourceUrl(objectUrl);
      })
      .catch((e) => active && setSourceError((e as Error).message));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [runId, run?.source_file_s3_key]);

  const data: AgentRunData | undefined = run?.corrected_data || run?.extracted_data || undefined;
  const forex = forexDraft;
  const totals = data?.totals || {};
  // Flag when the extracted grand total drifts from the PO's stated total.
  const statedTotal = forex?.expected_total ?? null;
  const grandTotal = totals.grand_total_myr ?? null;
  const totalDelta = statedTotal != null && grandTotal != null ? Math.round((grandTotal - statedTotal) * 100) / 100 : null;
  const totalMismatch = totalDelta != null && Math.abs(totalDelta) > 0.05;
  const documents = (run?.output_refs as { documents?: { do?: DocPreview; invoice?: DocPreview } } | undefined)?.documents;
  const whatsappDelivery = (run?.output_refs as { notify?: { status?: string; detail?: string; note?: string } } | undefined)?.notify;
  const sqlAccountDelivery = (run?.output_refs as { sql_account?: SqlAccountDelivery } | undefined)?.sql_account;
  const sourceWarnings = (data?.source?.warnings as string[] | undefined) || [];
  const orderLines = lines.filter((line) => line.category !== 'header');
  const headingCount = lines.length - orderLines.length;
  const hasAllMyrAmounts = orderLines.length > 0 && orderLines.every((line) => line.amount_myr != null);
  const sourceName = run?.source_filename || 'received document';
  const sourceExt = sourceName.split('.').pop()?.toLowerCase() || '';
  const sourceIsPdf = sourceMime === 'application/pdf' || sourceExt === 'pdf';
  const sourceIsImage = sourceMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(sourceExt);
  const sourceIsSpreadsheet = ['xls', 'xlsx', 'xlsm', 'csv'].includes(sourceExt);
  const originalCurrency = forex?.currency || data?.currency || 'source currency';

  const buildCorrected = (): AgentRunData => ({
    ...(data || {}),
    customer: customerDraft.trim() || null,
    customer_code: customerCodeDraft.trim() || null,
    customer_address: customerAddressDraft.trim() || null,
    customer_attn: customerAttnDraft.trim() || null,
    customer_phone: customerPhoneDraft.trim() || null,
    customer_email: customerEmailDraft.trim() || null,
    code: documentCodeDraft.trim() || null,
    inv_date: invoiceDateDraft.trim() || null,
    no_conversion: noConversion,
    forex,
    lines,
  });

  const updateLine = (index: number, patch: Partial<AgentRunLine>) => {
    setLines((previous) => previous.map((line, current) => {
      if (current !== index) return line;
      const next = { ...line, ...patch };
      if (next.qty != null && next.unit_price_foreign != null) {
        next.amount_foreign = Math.round(next.qty * next.unit_price_foreign * 100) / 100;
      }
      return next;
    }));
  };

  const addLine = () => {
    setLines((previous) => [...previous, { name: '', qty: null, unit_price_foreign: null, amount_foreign: null }]);
  };

  const deleteLine = (index: number) => {
    setLines((previous) => previous.filter((_, current) => current !== index));
  };

  const updateMatch = (index: number, patch: Partial<NonNullable<AgentRunLine['match']>>) => {
    setLines((previous) => previous.map((line, current) => (current === index
      ? { ...line, match: { matched: true, confidence: 1, ...(line.match || {}), ...patch } }
      : line)));
  };

  const updateForex = (patch: Partial<AgentRunForex>) => {
    setForexDraft((previous) => ({
      currency: data?.currency || 'RMB',
      operator: '/',
      flat_fee: 0,
      ...(previous || {}),
      ...patch,
    }));
  };

  // Track which action is running, not just that one is. SQL Account pushes wait
  // on the connector for up to 90s, so the clicked button has to show progress
  // while the rest stay disabled against concurrent edits to the same run.
  const act = async (key: string, fn: () => Promise<AgentRun>) => {
    setPending(key);
    try {
      hydrate(await fn());
    } catch (e) {
      alert((e as Error)?.message || 'Action failed');
    } finally {
      setPending(null);
    }
  };

  const status = run?.status;
  const canReview = status === 'PENDING_REVIEW' || status === 'DRAFT_GENERATED';
  const needsSqlCustomer = status === 'COMPLETED' && sqlAccountDelivery?.status !== 'created';

  return (
    <AppLayout pageName={`PO Run #${runId}`}>
      <button onClick={() => run && router.push(`/agents/${run.agent_id}`)} className="mb-4 text-sm text-[var(--muted-foreground)] flex items-center gap-1 hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Back to agent
      </button>

      {loading && <p className="text-[var(--muted-foreground)]">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {run && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div className="text-sm space-y-1">
                <div><span className="text-[var(--muted-foreground)]">Customer: </span><b>{data?.customer || '—'}</b></div>
                <div><span className="text-[var(--muted-foreground)]">Code: </span>{data?.code || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Invoice date: </span>{data?.inv_date || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Status: </span><b>{status}</b>{run.revision ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Revision R{run.revision}</span> : null}</div>
              </div>
              {run.source_caption && (
                <div className="max-w-xl">
                  <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">WhatsApp message / conversion instruction</p>
                  <pre className="text-xs bg-[var(--muted)] rounded-md p-3 whitespace-pre-wrap">{run.source_caption}</pre>
                </div>
              )}
            </div>

            {(status === 'RECEIVED' || status === 'EXTRACTING') && (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-4">
                <LoaderCircle className="h-5 w-5 animate-spin text-[var(--primary)]" />
                <div className="text-sm">
                  <p className="font-medium">Agent is working on this order…</p>
                  <p className="text-[var(--muted-foreground)]">{status === 'EXTRACTING'
                    ? 'Reading the document and extracting line items. Large orders (900+ items) can take a minute or two — this page updates automatically.'
                    : 'Received — queued for extraction. This page updates automatically.'}</p>
                </div>
              </div>
            )}

            {forex && (
              <div className={`mt-4 rounded-md p-3 text-sm flex items-center gap-2 ${forex.matches === false ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                {forex.matches === false ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>
                  {forex.raw || `${forex.currency} ${fmt(forex.amount)} ${forex.operator} ${forex.rate}`}
                  {' → '} computed <b>RM {fmt(forex.computed_total)}</b>
                  {forex.expected_total != null && <> vs stated <b>RM {fmt(forex.expected_total)}</b></>}
                  {forex.matches === false ? ' — mismatch, please check' : forex.matches ? ' — matches ✓' : ''}
                </span>
              </div>
            )}
            {run.error_message && <p className="mt-3 text-sm text-red-600">{run.error_message}</p>}
            {status === 'DRAFT_GENERATED' && <div className="mt-3 rounded-md bg-violet-500/10 p-3 text-sm text-violet-900 dark:text-violet-100"><b>Approval destination:</b> the configured outputs will run now, including SQL Account if it is enabled in this agent’s configuration.</div>}
            {status === 'COMPLETED' && sqlAccountDelivery && <div className={`mt-3 rounded-md p-3 text-sm ${sqlAccountDelivery.status === 'created' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'}`}>
              {sqlAccountDelivery.status === 'created' ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}
              <b>SQL Account:</b> {sqlAccountDelivery.status === 'created'
                ? `created Delivery Order ${sqlAccountDelivery.delivery_order?.document_no || '—'} and Sales Invoice ${sqlAccountDelivery.invoice?.document_no || '—'}.`
                : `not posted. ${sqlAccountDelivery.detail || sqlAccountDelivery.note || 'Check the SQL Account connection and master-data matches.'}`}
              {sqlAccountDelivery.status === 'created' && sqlAccountDelivery.note && <p className="mt-2 text-xs">⚠ {sqlAccountDelivery.note}</p>}
              {sqlAccountDelivery.customer_creation?.customer?.code && <p className="mt-2 text-xs"><b>Customer master:</b> {sqlAccountDelivery.customer_creation.status === 'created' ? 'created' : 'already existed'} — {sqlAccountDelivery.customer_creation.customer.code} {sqlAccountDelivery.customer_creation.customer.company_name ? `(${sqlAccountDelivery.customer_creation.customer.company_name})` : ''}.</p>}
            </div>}
            {sourceWarnings.length > 0 && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <b>Extraction needs attention:</b> {sourceWarnings.join(', ').replaceAll('_', ' ')}
              </div>
            )}
          </div>

          {canReview && (
            <section className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-5">
              <h2 className="font-semibold">Document and customer details</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Confirm the buyer details before generating. An SQL Account customer code is optional until you post to SQL Account.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Customer / company name"><input value={customerDraft} onChange={(event) => setCustomerDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="SQL Account customer code"><input maxLength={10} value={customerCodeDraft} onChange={(event) => setCustomerCodeDraft(event.target.value.toUpperCase())} placeholder="Optional" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Reference code"><input value={documentCodeDraft} onChange={(event) => setDocumentCodeDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Invoice date"><input type="date" value={invoiceDateDraft} onChange={(event) => setInvoiceDateDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Attn"><input value={customerAttnDraft} onChange={(event) => setCustomerAttnDraft(event.target.value)} placeholder="Contact person" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Phone"><input value={customerPhoneDraft} onChange={(event) => setCustomerPhoneDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Email"><input value={customerEmailDraft} onChange={(event) => setCustomerEmailDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Address"><input value={customerAddressDraft} onChange={(event) => setCustomerAddressDraft(event.target.value)} placeholder="Billing / delivery address" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">Contact details are pulled from the document when present; edit them and they print in the DO/Invoice header.</p>
            </section>
          )}

          <section className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Received file</h2>
                <p className="text-xs text-[var(--muted-foreground)]">{sourceName} · {run.source_channel?.replaceAll('_', ' ')}</p>
              </div>
              {sourceUrl && <a href={sourceUrl} download={sourceName} className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"><Download className="h-4 w-4" /> Download original</a>}
            </div>
            {sourceUrl && sourceIsPdf && <iframe title={`Preview of ${sourceName}`} src={sourceUrl} className="h-[620px] w-full bg-white" />}
            {sourceUrl && sourceIsImage && <div className="bg-[var(--muted)] p-4"><img src={sourceUrl} alt={`Preview of ${sourceName}`} className="mx-auto max-h-[620px] rounded object-contain" /></div>}
            {sourceUrl && sourceIsSpreadsheet && <div className="flex min-h-40 items-center justify-center gap-3 p-8 text-sm text-[var(--muted-foreground)]"><FileSpreadsheet className="h-8 w-8 text-green-700" /> Excel is retained in its original form. Download it to inspect the source cells.</div>}
            {sourceUrl && !sourceIsPdf && !sourceIsImage && !sourceIsSpreadsheet && <div className="flex min-h-40 items-center justify-center gap-3 p-8 text-sm text-[var(--muted-foreground)]"><ImageIcon className="h-8 w-8" /> This file type is available to download.</div>}
            {!run.source_file_s3_key && <p className="p-5 text-sm text-[var(--muted-foreground)]">This older run was created before source-file retention. Send/upload the file again to preview it here.</p>}
            {sourceError && <p className="p-5 text-sm text-amber-700">{sourceError}</p>}
          </section>

          {canReview && (
            <section className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Conversion details</h2>
                  <p className="text-sm text-[var(--muted-foreground)]">Review the rate extracted from the WhatsApp message. Saving recalculates every MYR line value.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={noConversion} onChange={(event) => { setNoConversion(event.target.checked); if (event.target.checked) setForexDraft(null); }} className="h-4 w-4 accent-[var(--primary)]" /> Already MYR — no conversion</label>
                {!noConversion && !forex && <button type="button" onClick={() => updateForex({})} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]">Add conversion rate</button>}
              </div>
              {noConversion && <p className="mt-2 rounded-md bg-[var(--muted)] p-3 text-sm text-[var(--muted-foreground)]">This order is treated as already in MYR. The extracted prices are used directly with no exchange rate.</p>}
              {noConversion ? null : forex ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Original currency"><input value={forex.currency || ''} onChange={(e) => updateForex({ currency: e.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Formula amount"><input type="number" value={forex.amount ?? ''} onChange={(e) => updateForex({ amount: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Operator"><select value={forex.operator || '/'} onChange={(e) => updateForex({ operator: e.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]"><option value="/">÷</option><option value="*">×</option></select></Field>
                  <Field label="Conversion rate"><input type="number" step="any" value={forex.rate ?? ''} onChange={(e) => updateForex({ rate: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Flat fee (MYR)"><input type="number" step="any" value={forex.flat_fee ?? ''} onChange={(e) => updateForex({ flat_fee: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                </div>
              ) : <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Conversion rate required: this foreign-currency PO cannot be generated as an RM 0.00 invoice. Add the rate from WhatsApp, or tick “Already MYR” only when the source prices are already MYR.</p>}
            </section>
          )}

          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
            <div className="p-4 border-b border-[var(--border)] font-semibold">Extracted order lines ({orderLines.length}){headingCount ? <span className="font-normal text-[var(--muted-foreground)]"> + {headingCount} section heading{headingCount === 1 ? '' : 's'}</span> : null}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[var(--muted-foreground)]">
                  <th className="px-3 py-2">Product (source)</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">English description</th>
                  <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit ({originalCurrency})</th><th className="px-3 py-2 text-right">Amount ({originalCurrency})</th>
                  <th className="px-3 py-2 text-right">Unit (MYR)</th><th className="px-3 py-2 text-right">Amount (MYR)</th><th className="px-3 py-2">Match</th>
                  {canReview && <th className="px-3 py-2 w-px"><span className="sr-only">Actions</span></th>}
                </tr></thead>
                <tbody>{lines.map((line, index) => (
                  <tr key={index} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-2">{canReview
                      ? <><input value={line.name || ''} onChange={(e) => updateLine(index, { name: e.target.value })} placeholder="Item name" className="w-48 rounded border border-[var(--border)] bg-transparent px-2 py-1" /><input value={line.model || ''} onChange={(e) => updateLine(index, { model: e.target.value })} placeholder="Model / code" className="mt-1 w-48 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs" /><div className="mt-1 flex gap-1"><input value={line.color || ''} onChange={(e) => updateLine(index, { color: e.target.value })} placeholder="Color" className="w-24 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs" /><input value={line.unit || ''} onChange={(e) => updateLine(index, { unit: e.target.value })} placeholder="UOM" className="w-16 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs" /></div></>
                      : <><div>{line.name}</div><div className="text-xs text-[var(--muted-foreground)]">{[line.model, line.color, line.unit].filter(Boolean).join(' · ')}</div></>}</td>
                    <td className="px-3 py-2"><input disabled={!canReview} value={line.match?.sku_code || ''} onChange={(e) => updateMatch(index, { sku_code: e.target.value })} className="w-24 rounded border border-[var(--border)] bg-transparent px-2 py-1" /></td>
                    <td className="px-3 py-2"><input disabled={!canReview} value={line.match?.en_description || ''} onChange={(e) => updateMatch(index, { en_description: e.target.value })} className="w-56 rounded border border-[var(--border)] bg-transparent px-2 py-1" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" value={line.qty ?? ''} onChange={(e) => updateLine(index, { qty: numeric(e.target.value) })} className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" step="any" value={line.unit_price_foreign ?? ''} onChange={(e) => updateLine(index, { unit_price_foreign: numeric(e.target.value) })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" step="any" value={line.amount_foreign ?? ''} onChange={(e) => updateLine(index, { amount_foreign: numeric(e.target.value) })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right">{fmt(line.unit_price_myr)}</td><td className="px-3 py-2 text-right">{fmt(line.amount_myr)}</td>
                    <td className="px-3 py-2">{line.match?.matched ? <span className="text-xs text-green-700">{Math.round((line.match.confidence || 0) * 100)}%</span> : <span className="text-xs text-amber-700">unmatched</span>}</td>
                    {canReview && <td className="px-3 py-2"><button type="button" onClick={() => deleteLine(index)} aria-label={`Delete line ${index + 1}`} title="Delete this line" className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"><Trash2 className="h-4 w-4" /></button></td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {canReview && <div className="px-4 py-3 border-t border-[var(--border)]"><button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--hover-bg)]"><Plus className="h-4 w-4" /> Add line</button></div>}
            <div className="border-t border-[var(--border)]">
              {totalMismatch && <div className="px-4 pt-3 flex justify-end"><span className="rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">⚠ Extracted total <b>RM {fmt(grandTotal)}</b> vs PO stated <b>RM {fmt(statedTotal)}</b> — differ by <b>RM {fmt(totalDelta)}</b>. Check the lines before generating.</span></div>}
              <div className="p-4 text-sm flex flex-wrap gap-6 justify-end"><span>Original total: <b>{fmt(totals.amount_foreign_total)}</b></span><span>Qty total: <b>{fmt(totals.qty_total)}</b></span>{totals.flat_fee ? <span className="text-[var(--muted-foreground)]">Handling fee RM {fmt(totals.flat_fee)} folded into unit prices</span> : null}<span>Grand total: <b>{totals.grand_total_myr == null ? 'Conversion required' : `RM ${fmt(totals.grand_total_myr)}`}</b></span></div>
            </div>
          </div>

          {documents && <div className="grid gap-6 lg:grid-cols-2"><DocCard title="Delivery Order" doc={documents.do} withPrices={false} /><DocCard title="Invoice" doc={documents.invoice} withPrices /></div>}

          {status === 'COMPLETED' && sqlAccountDelivery?.status === 'needs_customer_approval' && customerProposal && (
            <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
              <h2 className="font-semibold">Suggested SQL Account customer</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">No high-confidence customer match was found. Review this proposal, then create it in SQL Account and retry this run. This action does not create stock items.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Customer code"><input maxLength={10} value={customerProposal.code} onChange={(event) => setCustomerProposal({ ...customerProposal, code: event.target.value.toUpperCase() })} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Company name"><input value={customerProposal.company_name} onChange={(event) => setCustomerProposal({ ...customerProposal, company_name: event.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Billing address"><textarea value={customerProposal.address || ''} onChange={(event) => setCustomerProposal({ ...customerProposal, address: event.target.value })} rows={3} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] sm:col-span-2" /></Field>
              </div>
              <button disabled={busy || customerProposal.code.trim().length < 2 || customerProposal.company_name.trim().length < 2} onClick={() => act('proposal-customer', () => createSqlAccountCustomerAndRepush(runId, { ...customerProposal, attn: customerAttnDraft.trim() || null, phone: customerPhoneDraft.trim() || null, email: customerEmailDraft.trim() || null }))} className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{pending === 'proposal-customer' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'proposal-customer' ? 'Creating customer in SQL Account…' : 'Create customer & re-push'}</button>
            </section>
          )}
          {needsSqlCustomer && (
            <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
              <h2 className="font-semibold">Set SQL Account customer</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">The document did not contain a usable customer. Enter an existing SQL Account customer code, or create a reviewed customer master and immediately re-push this run.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Customer / company name"><input value={customerDraft} onChange={(event) => setCustomerDraft(event.target.value)} placeholder="e.g. COMPANY SDN BHD" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="SQL Account customer code"><input maxLength={10} value={customerCodeDraft} onChange={(event) => setCustomerCodeDraft(event.target.value.toUpperCase())} placeholder="Existing or new code" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Attn"><input value={customerAttnDraft} onChange={(event) => setCustomerAttnDraft(event.target.value)} placeholder="Contact person" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Phone"><input value={customerPhoneDraft} onChange={(event) => setCustomerPhoneDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Email"><input value={customerEmailDraft} onChange={(event) => setCustomerEmailDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Billing address"><textarea value={customerAddressDraft} onChange={(event) => setCustomerAddressDraft(event.target.value)} rows={2} placeholder="Saved on the new SQL Account customer master" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] sm:col-span-2" /></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button disabled={busy || customerCodeDraft.trim().length < 2} onClick={() => act('existing-code', async () => { await reviewRun(runId, buildCorrected()); return repushRunToSqlAccount(runId); })} className="inline-flex items-center gap-2 rounded-md border border-violet-500/50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300">{pending === 'existing-code' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'existing-code' ? 'Pushing to SQL Account…' : 'Use existing code & re-push'}</button>
                <button disabled={busy || customerCodeDraft.trim().length < 2 || customerDraft.trim().length < 2} onClick={() => act('manual-customer', async () => { await reviewRun(runId, buildCorrected()); return createSqlAccountCustomerAndRepush(runId, { code: customerCodeDraft, company_name: customerDraft, address: customerAddressDraft.trim() || null, attn: customerAttnDraft.trim() || null, phone: customerPhoneDraft.trim() || null, email: customerEmailDraft.trim() || null }); })} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{pending === 'manual-customer' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'manual-customer' ? 'Creating customer in SQL Account…' : 'Create customer & re-push'}</button>
              </div>
            </section>
          )}
          {status === 'COMPLETED' && sqlAccountDelivery?.status === 'needs_item_approval' && itemProposals.length > 0 && (
            <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5"><h2 className="font-semibold">Suggested SQL Account stock items</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">These products were not found in SQL Account. Review the proposed master records before creating them.</p><div className="mt-4 space-y-3">{itemProposals.map((item, index) => <div key={item.source_index} className="grid gap-3 rounded border border-[var(--border)] p-3 sm:grid-cols-[160px_1fr_100px]"><input value={item.code} onChange={(event) => setItemProposals((items) => items.map((value, current) => current === index ? { ...value, code: event.target.value.toUpperCase() } : value))} className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm" /><input value={item.description} onChange={(event) => setItemProposals((items) => items.map((value, current) => current === index ? { ...value, description: event.target.value } : value))} className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm" /><input value={item.uom || 'UNIT'} onChange={(event) => setItemProposals((items) => items.map((value, current) => current === index ? { ...value, uom: event.target.value } : value))} className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm" /></div>)}</div><button disabled={busy} onClick={() => act('create-items', () => createSqlAccountItemsAndRepush(runId, itemProposals))} className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{pending === 'create-items' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'create-items' ? 'Creating stock items in SQL Account…' : 'Create items & re-push'}</button></section>
          )}

          <div className="flex flex-wrap gap-3">
            {status === 'PENDING_REVIEW' && <>
              <button disabled={busy} onClick={() => act('save', () => reviewRun(runId, buildCorrected()))} className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] disabled:opacity-50 flex items-center gap-2">{pending === 'save' && <LoaderCircle className="h-4 w-4 animate-spin" />} {pending === 'save' ? 'Saving…' : 'Save corrections'}</button>
              <button disabled={busy || !hasAllMyrAmounts} title={hasAllMyrAmounts ? undefined : 'Every line needs an original price and a valid MYR conversion before invoice generation'} onClick={() => act('generate', async () => { await reviewRun(runId, buildCorrected()); return generateRun(runId); })} className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2">{pending === 'generate' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {pending === 'generate' ? 'Generating DO + Invoice…' : 'Generate DO + Invoice'}</button>
            </>}
            {status === 'DRAFT_GENERATED' && <>
              <button disabled={busy || !hasAllMyrAmounts} onClick={() => act('regenerate', async () => { await reviewRun(runId, buildCorrected()); return generateRun(runId); })} className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] disabled:opacity-50 flex items-center gap-2">{pending === 'regenerate' && <LoaderCircle className="h-4 w-4 animate-spin" />} {pending === 'regenerate' ? 'Re-generating…' : 'Re-generate'}</button>
              <button disabled={busy} onClick={() => act('approve', () => approveRun(runId, buildCorrected()))} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">{pending === 'approve' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'approve' ? 'Approving & running outputs…' : 'Approve & run configured outputs'}</button>
            </>}
            {(status === 'PENDING_REVIEW' || status === 'DRAFT_GENERATED') && <button disabled={busy} onClick={() => act('reject', () => rejectRun(runId, 'Rejected by reviewer'))} className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-2">{pending === 'reject' && <LoaderCircle className="h-4 w-4 animate-spin" />} {pending === 'reject' ? 'Rejecting…' : 'Reject'}</button>}
            {status === 'COMPLETED' && (
              whatsappDelivery?.status === 'sent'
                ? <span className="text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Completed — Delivery Order and Invoice PDFs were sent to WhatsApp.</span>
                : whatsappDelivery?.status === 'failed'
                  ? <span className="text-amber-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> PDFs were generated, but WhatsApp delivery failed: {whatsappDelivery.detail || whatsappDelivery.note || 'check the bridge connection'}.</span>
                  : <span className="text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Completed — DO + Invoice generated.</span>
            )}
            {status === 'COMPLETED' && whatsappDelivery?.status === 'failed' && (
              <button disabled={busy} onClick={() => act('whatsapp', () => sendRunToWhatsApp(runId))} className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50 flex items-center gap-2">{pending === 'whatsapp' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'whatsapp' ? 'Sending to WhatsApp…' : 'Retry WhatsApp delivery'}</button>
            )}
            {status === 'COMPLETED' && (
              <button disabled={busy} onClick={() => act('sql-push', () => repushRunToSqlAccount(runId))} className="px-4 py-2 border border-violet-500/50 text-violet-700 rounded-md hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300 flex items-center gap-2">{pending === 'sql-push' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {pending === 'sql-push' ? 'Pushing to SQL Account…' : sqlAccountDelivery ? 'Re-push to SQL Account' : 'Push to SQL Account'}</button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-xs text-[var(--muted-foreground)]">{label}{children}</label>;
}

interface DocPreview {
  doc_no?: string;
  header?: { seller_entity?: string; customer?: string; customer_address?: string | null; customer_attn?: string | null; customer_phone?: string | null; customer_email?: string | null; date?: string; currency?: string };
  lines?: Array<{ no: number; item_code?: string | null; description?: string | null; color?: string | null; uom?: string | null; qty?: number | null; unit_price?: number | null; amount?: number | null; foc?: boolean; is_header?: boolean }>;
  separate_item_code?: boolean;
  show_uom?: boolean;
  show_color?: boolean;
  total_qty?: number | null;
  fee_note?: string | null;
  grand_total?: number | null;
}

interface SqlAccountDelivery {
  status?: string;
  note?: string;
  detail?: string;
  delivery_order?: { document_no?: string | null };
  invoice?: { document_no?: string | null };
  customer_proposal?: SqlAccountCustomerProposal;
  customer_creation?: { status?: string; customer?: { code?: string; company_name?: string } };
  item_proposals?: SqlAccountStockItemProposal[];
}

function DocCard({ title, doc, withPrices }: { title: string; doc?: DocPreview; withPrices: boolean }) {
  if (!doc) return null;
  const h = doc.header;
  const showCode = doc.separate_item_code !== false;
  const showColor = !!doc.show_color;
  const showUom = !!doc.show_uom;
  const contact = [h?.customer_attn && `Attn: ${h.customer_attn}`, h?.customer_phone, h?.customer_email, h?.customer_address].filter(Boolean).join(' · ');
  return <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-5">
    <div className="flex justify-between items-baseline"><h3 className="font-bold">{title}</h3><span className="text-sm text-[var(--muted-foreground)]">{doc.doc_no}</span></div>
    <div className="mt-1 text-sm text-[var(--muted-foreground)]">{h?.seller_entity} → {h?.customer} · {h?.date}</div>
    {contact && <div className="text-xs text-[var(--muted-foreground)]">{contact}</div>}
    <table className="w-full text-xs mt-3"><thead><tr className="text-left text-[var(--muted-foreground)]"><th className="py-1">#</th>{showCode && <th className="py-1">Code</th>}<th className="py-1">Description</th>{showColor && <th className="py-1">Color</th>}<th className="py-1 text-right">Qty</th>{showUom && <th className="py-1">UOM</th>}{withPrices && <><th className="py-1 text-right">Unit</th><th className="py-1 text-right">Amount</th></>}</tr></thead>
      <tbody>{(doc.lines || []).map((line) => <tr key={line.no} className="border-t border-[var(--border)]"><td className="py-1">{line.no}</td>{showCode && <td className="py-1">{line.item_code || '—'}</td>}<td className="py-1">{line.description}</td>{showColor && <td className="py-1">{line.is_header ? '' : (line.color || '')}</td>}<td className="py-1 text-right">{line.is_header ? '' : fmt(line.qty)}</td>{showUom && <td className="py-1">{line.is_header ? '' : (line.uom || '')}</td>}{withPrices && <><td className="py-1 text-right">{line.is_header ? '' : fmt(line.unit_price)}</td><td className="py-1 text-right">{line.is_header ? '' : fmt(line.amount)}</td></>}</tr>)}</tbody>
    </table>
    <div className="mt-2 text-right text-sm">{withPrices ? <><b>Total RM {fmt(doc.grand_total)}</b>{doc.fee_note ? <div className="text-xs font-normal text-[var(--muted-foreground)]">{doc.fee_note}</div> : null}</> : <>Total qty <b>{fmt(doc.total_qty)}</b></>}</div>
  </div>;
}
