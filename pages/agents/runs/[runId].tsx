'use client';

import { AppLayout } from '@/components/layout';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, CheckCircle2, AlertTriangle, FileText, Send, Download, FileSpreadsheet, Image as ImageIcon, Clock3, History, Inbox, ShieldCheck, Plus, Trash2, X, LoaderCircle } from 'lucide-react';
import {
  getRun, getRunSource, getRunFile, reviewRun, refreshPaymentPreview, generateRun, approveRun, retryRunDelivery, sendRunToWhatsApp, repushRunToSqlAccount, createSqlAccountCustomerAndRepush, createSqlAccountItemsAndRepush, rejectRun, listRuns, combineRuns,
  type AgentRun, type AgentRunData, type AgentRunForex, type AgentRunLine, type SqlAccountCustomerProposal, type SqlAccountStockItemProposal,
  type ReviewFieldDefinition, type AgentRunListItem,
} from '@/services/AgentsService';
import { listKnowledgeSources } from '@/services/KnowledgeBaseService';

type BusinessEntityProfile = {
  entity_key: string;
  legal_name: string;
  display_name?: string;
  role?: string;
  route?: string;
  fulfilment_mode?: string;
  aliases?: string[];
  sql_connection_id?: number | null;
};

const fmt = (n?: number | null) => (n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const numeric = (value: string) => (value === '' ? null : Number(value));

const normalizeRunLine = (value: unknown): AgentRunLine => {
  const line = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const rawMatch = (line.match && typeof line.match === 'object' ? line.match : {}) as Record<string, unknown>;
  return {
    ...line,
    name: String(line.name ?? line.source_description ?? line.description ?? ''),
    model: String(line.model ?? line.model_or_part_number ?? line.item_code ?? ''),
    unit: (line.unit ?? line.uom ?? undefined) as string | undefined,
    qty: (line.qty ?? line.quantity ?? null) as number | null,
    category: (line.category ?? line.line_category ?? null) as string | null,
    unit_price_foreign: (line.unit_price_foreign ?? null) as number | null,
    amount_foreign: (line.amount_foreign ?? line.line_amount_foreign ?? null) as number | null,
    unit_price_myr: (line.unit_price_myr ?? line.converted_unit_price_myr ?? null) as number | null,
    amount_myr: (line.amount_myr ?? line.converted_line_amount_myr ?? null) as number | null,
    match: {
      matched: Boolean(rawMatch.matched ?? line.matched_internal_sku),
      confidence: Number(rawMatch.confidence ?? (line.matched_internal_sku ? 1 : 0)),
      sku_code: (rawMatch.sku_code ?? line.matched_internal_sku ?? null) as string | null,
      en_description: (rawMatch.en_description ?? line.english_description ?? null) as string | null,
      matched_alias: (rawMatch.matched_alias ?? null) as string | null,
      item_id: (rawMatch.item_id ?? null) as number | null,
    },
  };
};

const canonicalRunLines = (data?: AgentRunData | null): AgentRunLine[] => {
  const configuredLines = (data as (AgentRunData & { line_items?: unknown[] }) | null | undefined)?.line_items;
  const values = data?.lines?.length ? data.lines : (Array.isArray(configuredLines) ? configuredLines : []);
  return values.map(normalizeRunLine);
};

export function AutomationRunReview({ reviewMode = false }: { reviewMode?: boolean }) {
  const router = useRouter();
  const runId = Number(router.query.runId);

  const [run, setRun] = useState<AgentRun | null>(null);
  const [lines, setLines] = useState<AgentRunLine[]>([]);
  const [forexDraft, setForexDraft] = useState<AgentRunForex | null>(null);
  const [customerDraft, setCustomerDraft] = useState('');
  const [customerCodeDraft, setCustomerCodeDraft] = useState('');
  const [documentCodeDraft, setDocumentCodeDraft] = useState('');
  const [invoiceDateDraft, setInvoiceDateDraft] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerProposal, setCustomerProposal] = useState<SqlAccountCustomerProposal | null>(null);
  const [itemProposals, setItemProposals] = useState<SqlAccountStockItemProposal[]>([]);
  const [genericDraft, setGenericDraft] = useState<Record<string, unknown>>({});
  const [packageCandidates, setPackageCandidates] = useState<AgentRunListItem[]>([]);
  const [combineRunId, setCombineRunId] = useState('');
  const [showProceedModal, setShowProceedModal] = useState(false);
  const [pendingLineRemoval, setPendingLineRemoval] = useState<number | null>(null);
  const [entityProfiles, setEntityProfiles] = useState<BusinessEntityProfile[]>([]);
  const [issuingEntityKey, setIssuingEntityKey] = useState('');

  const hydrate = (r: AgentRun) => {
    setRun(r);
    const reviewed = r.corrected_data || r.extracted_data;
    setGenericDraft({ ...((reviewed || {}) as Record<string, unknown>) });
    setLines(canonicalRunLines(reviewed));
    setForexDraft(reviewed?.forex ? { ...reviewed.forex } : null);
    setCustomerDraft(reviewed?.customer || '');
    setCustomerCodeDraft(reviewed?.customer_code || '');
    setDocumentCodeDraft(reviewed?.code || '');
    setInvoiceDateDraft(reviewed?.inv_date || '');
    setIssuingEntityKey(reviewed?.issuing_entity?.entity_key || reviewed?.issuing_entity?.key || '');
    const proposal = (r.output_refs as { sql_account?: { customer_proposal?: SqlAccountCustomerProposal } } | undefined)?.sql_account?.customer_proposal;
    setCustomerProposal(proposal?.code && proposal.code.length <= 10 && proposal.company_name ? { code: proposal.code, company_name: proposal.company_name, address: proposal.address || '' } : null);
    setItemProposals((r.output_refs as { sql_account?: { item_proposals?: SqlAccountStockItemProposal[] } } | undefined)?.sql_account?.item_proposals || []);
  };

  const load = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      let loaded = await getRun(runId);
      const paymentData = loaded.corrected_data || loaded.extracted_data;
      const hasPaymentMethods = Array.isArray(paymentData?.payment_methods) && paymentData.payment_methods.length > 0;
      if (loaded.review_schema?.template_key === 'payment_knock_off' && !hasPaymentMethods) {
        try {
          loaded = await refreshPaymentPreview(runId);
          setError(null);
        } catch (refreshError) {
          setError((refreshError as Error)?.message || 'Could not refresh SQL payment methods');
        }
      }
      hydrate(loaded);
      if (loaded.review_schema?.template_key !== 'payment_knock_off') setError(null);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    listKnowledgeSources().then((response) => {
      if (!active) return;
      const profiles = response.items
        .filter((source) => source.status === 'STORED' && source.reference_type === 'BUSINESS_ENTITY_REGISTRY')
        .flatMap((source) => Array.isArray(source.metadata_json?.entities) ? source.metadata_json.entities : [])
        .filter((item) => typeof item?.legal_name === 'string' && typeof (item.entity_key || item.key) === 'string')
        .map((item) => ({ ...item, entity_key: String(item.entity_key || item.key), route: String(item.route || item.fulfilment_mode || 'INTERNAL') } as BusinessEntityProfile));
      setEntityProfiles(Array.from(new Map(profiles.map((profile) => [profile.entity_key, profile])).values()));
    }).catch(() => active && setEntityProfiles([]));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!run?.agent_id) return;
    let active = true;
    listRuns({ agentId: run.agent_id, pageSize: 100 })
      .then((response) => {
        if (!active) return;
        setPackageCandidates(response.runs.filter((item) => (
          item.id !== run.id && ['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(item.status)
        )));
      })
      .catch(() => active && setPackageCandidates([]));
    return () => { active = false; };
  }, [run?.agent_id, run?.id]);

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
  const conversion = data?.conversion;
  const whatsappDelivery = (run?.output_refs as { notify?: { status?: string; detail?: string; note?: string } } | undefined)?.notify;
  const sqlAccountDelivery = (run?.output_refs as { sql_account?: SqlAccountDelivery } | undefined)?.sql_account;
  const agentExecution = (run?.output_refs as { agent_execution?: { status?: string; detail?: string; plan?: { summary?: string; authority?: string; steps?: Array<{ sequence: number; tool: string; purpose: string; requires_approval?: boolean }>; warnings?: string[] }; tool_results?: Array<{ tool: string; status: string; detail: string }> } } | undefined)?.agent_execution;
  const outsourcedEmail = (run?.output_refs as { outsourced_email?: OutsourcedEmailDelivery } | undefined)?.outsourced_email;
  const externalDocuments = (run?.output_refs as { external_documents?: ExternalDocument[] } | undefined)?.external_documents || [];
  const sourceWarnings = (data?.source?.warnings as string[] | undefined) || [];
  const reconciliation = data?.reconciliation;
  const workPackage = data?.package;
  const selectedIssuingEntity = entityProfiles.find((profile) => profile.entity_key === issuingEntityKey);
  const fulfilmentRoute = String(selectedIssuingEntity?.route || selectedIssuingEntity?.fulfilment_mode || data?.fulfilment_route || data?.issuing_entity?.fulfilment_mode || 'INTERNAL').toUpperCase();
  const isOutsourced = fulfilmentRoute === 'OUTSOURCED';
  const orderLines = lines.filter((line) => !['header', 'included_component'].includes(line.category || ''));
  const headingCount = lines.filter((line) => line.category === 'header').length;
  const contextCount = lines.length - orderLines.length - headingCount;
  const hasAllMyrAmounts = orderLines.length > 0 && orderLines.every((line) => line.amount_myr != null);
  const waitingForDocuments = workPackage?.status === 'WAITING_FOR_DOCUMENTS';
  const canGenerateDocuments = (isOutsourced || hasAllMyrAmounts) && !waitingForDocuments;
  const preparationBlocker = waitingForDocuments
    ? `Cannot prepare this transaction yet: the source message expects ${workPackage?.expected_set_count || 'more'} document sets, but only ${workPackage?.received_primary_document_count || 1} has been received. ${workPackage?.remaining_foreign_total != null ? `${data?.currency || ''} ${fmt(workPackage.remaining_foreign_total)} is still missing. ` : ''}Add the related review item above, or correct the expected source total if the message was wrong.`
    : !isOutsourced && !hasAllMyrAmounts
      ? 'Cannot prepare this transaction yet: one or more order lines has no MYR amount. Add or correct the exchange-rate conversion first.'
      : null;
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
    code: documentCodeDraft.trim() || null,
    inv_date: invoiceDateDraft.trim() || null,
    issuing_entity: selectedIssuingEntity ? { ...selectedIssuingEntity, key: selectedIssuingEntity.entity_key, fulfilment_mode: selectedIssuingEntity.route || selectedIssuingEntity.fulfilment_mode || 'INTERNAL', status: 'RESOLVED' } : data?.issuing_entity,
    fulfilment_route: selectedIssuingEntity?.route || data?.fulfilment_route || null,
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

  const removeLine = (index: number) => {
    if (lines[index]) setPendingLineRemoval(index);
  };

  const confirmLineRemoval = () => {
    if (pendingLineRemoval == null) return;
    setLines((previous) => previous.filter((_, current) => current !== pendingLineRemoval));
    setPendingLineRemoval(null);
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

  const act = async (fn: () => Promise<AgentRun>, message = 'Saving changes…') => {
    setBusy(true);
    setBusyMessage(message);
    setError(null);
    try {
      hydrate(await fn());
    } catch (e) {
      setError((e as Error)?.message || 'Action failed');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  };

  const downloadExternalDocument = async (document: ExternalDocument) => {
    setBusy(true);
    setBusyMessage(`Downloading ${document.filename}...`);
    setError(null);
    try {
      const blob = await getRunFile(runId, document.file_key);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.filename || 'returned-document';
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error)?.message || 'Could not download the returned document');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  };

  const status = run?.status;
  const canReview = status === 'PENDING_REVIEW' || status === 'DRAFT_GENERATED';
  const needsSqlCustomer = !isOutsourced && status === 'DRAFT_GENERATED' && ['needs_customer_approval', 'failed'].includes(sqlAccountDelivery?.status || '');
  const isOrderWorkflow = run?.review_schema?.template_key === 'order_to_invoice'
    || run?.record_type === 'purchase_order'
    || Boolean(data?.forex && data?.lines);

  const prepareForSql = () => {
    if (preparationBlocker) {
      setShowProceedModal(true);
      return;
    }
    void act(async () => {
      await reviewRun(runId, buildCorrected());
      return generateRun(runId);
    });
  };

  const proceedDespiteMismatch = () => {
    setShowProceedModal(false);
    const corrected = {
      ...buildCorrected(),
      review_override: {
        proceed_with_source_mismatch: true,
        reason: 'Reviewer chose to proceed with the currently received documents and extracted total.',
      },
    };
    void act(async () => {
      await reviewRun(runId, corrected);
      return generateRun(runId);
    });
  };

  const displayedTotals = canReview ? {
    ...totals,
    qty_total: orderLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    amount_foreign_total: lines.reduce((sum, line) => sum + Number(line.amount_foreign || 0), 0),
    amount_myr_total: hasAllMyrAmounts
      ? orderLines.reduce((sum, line) => sum + Number(line.amount_myr || 0), 0)
      : null,
    grand_total_myr: hasAllMyrAmounts
      ? orderLines.reduce((sum, line) => sum + Number(line.amount_myr || 0), 0)
      : null,
  } : totals;

  if (run && !isOrderWorkflow) {
    return (
      <GenericWorkflowReview
        run={run}
        draft={genericDraft}
        setDraft={setGenericDraft}
        busy={busy}
        loading={loading}
        error={error}
        act={act}
      />
    );
  }

  return (
    <AppLayout pageName={reviewMode ? `Review item #${runId}` : `PO Run #${runId}`}>
      <button onClick={() => router.push(reviewMode ? '/review' : (run ? `/agents/${run.agent_id}` : '/review'))} className="mb-4 text-sm text-[var(--muted-foreground)] flex items-center gap-1 hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> {reviewMode ? 'Back to Review' : 'Back to automation'}
      </button>

      {loading && <p className="text-[var(--muted-foreground)]">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {busy && busyMessage && (
        <div role="status" aria-live="polite" className="mb-4 flex items-start gap-3 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 shadow-sm dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50">
          <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <div>
            <p className="text-sm font-semibold">{busyMessage}</p>
            <p className="mt-1 text-xs opacity-75">{isOutsourced ? 'Please keep this page open while Smartdok securely sends or retrieves the external documents.' : 'Please keep this page open. The accounting connection may take up to a minute to create the required records.'}</p>
          </div>
        </div>
      )}

      {run && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div className="text-sm space-y-1">
                <div><span className="text-[var(--muted-foreground)]">Issuing company: </span><b>{data?.issuing_entity?.legal_name || 'Not resolved'}</b>{data?.fulfilment_route && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{data.fulfilment_route.toLowerCase()}</span>}</div>
                <div><span className="text-[var(--muted-foreground)]">Customer: </span><b>{data?.customer || '—'}</b></div>
                <div><span className="text-[var(--muted-foreground)]">Code: </span>{data?.code || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Invoice date: </span>{data?.inv_date || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Status: </span><b>{status}</b></div>
              </div>
              {run.source_caption && (
                <div className="max-w-xl">
                  <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">WhatsApp message / conversion instruction</p>
                  <pre className="text-xs bg-[var(--muted)] rounded-md p-3 whitespace-pre-wrap">{run.source_caption}</pre>
                </div>
              )}
            </div>

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
            {conversion?.status === 'PENDING_RATE' && (
              <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div><p className="font-semibold">MYR conversion pending</p><p className="mt-1">The extracted {conversion.source_currency || originalCurrency} values are preserved. Add the applicable exchange rate before generating or posting documents; Smartdok will not treat the missing MYR value as zero.</p></div>
              </div>
            )}
            {run.error_message && <p className="mt-3 text-sm text-red-600">{run.error_message}</p>}
            {agentExecution && <div className="mt-4 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-slate-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-50"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">Agent execution plan</p><p className="mt-1 text-xs leading-5 text-slate-700 dark:text-cyan-100">{agentExecution.plan?.summary || agentExecution.detail || 'The bounded runtime is preparing a safe tool plan.'}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">{(agentExecution.status || 'planning').replaceAll('_', ' ').toLowerCase()}</span></div>{agentExecution.plan?.steps && agentExecution.plan.steps.length > 0 && <div className="mt-3 space-y-2">{[...agentExecution.plan.steps].sort((a, b) => a.sequence - b.sequence).map((step) => { const result = agentExecution.tool_results?.find((item) => item.tool === step.tool); return <div key={`${step.sequence}-${step.tool}`} className="flex gap-3 rounded-lg border border-cyan-200 bg-white p-3 text-xs dark:border-cyan-900 dark:bg-slate-950"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 font-semibold text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100">{step.sequence}</span><span className="min-w-0 flex-1"><strong className="block text-slate-950 dark:text-white">{step.tool.replaceAll('_', ' ').toLowerCase()}</strong><span className="mt-1 block text-slate-700 dark:text-slate-300">{result?.detail || step.purpose}</span></span><span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">{result ? result.status.replaceAll('_', ' ').toLowerCase() : step.requires_approval ? 'awaiting approval' : 'planned'}</span></div>; })}</div>}{agentExecution.plan?.warnings?.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-900 dark:text-amber-200">Warning: {warning}</p>)}</div>}
            {status === 'DRAFT_GENERATED' && !sqlAccountDelivery && <div className="mt-3 rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100"><b>Approval destination:</b> {isOutsourced ? 'approving sends the source PO to the external fulfilment provider configured for this issuing company. Smartdok tracks the email thread, collects the returned DO and invoice, then makes them ready to return to WhatsApp.' : 'approving creates the Delivery Order and Sales Invoice through the resolved company accounting connection. Smartdok then prepares customer PDFs and returns them to the source channel.'}</div>}
            {outsourcedEmail && ['WAITING_EXTERNAL_DOCUMENTS', 'EXTERNAL_DOCUMENTS_RECEIVED'].includes(status || '') && (
              <div className={`mt-3 rounded-lg border p-4 text-sm ${status === 'EXTERNAL_DOCUMENTS_RECEIVED' ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100'}`}>
                <div className="flex items-start gap-3">
                  {status === 'EXTERNAL_DOCUMENTS_RECEIVED' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold">{status === 'EXTERNAL_DOCUMENTS_RECEIVED' ? 'External documents received' : 'Waiting for the external provider'}</p>
                    <p className="mt-1 break-words">Email: <b>{outsourcedEmail.subject || 'Document request'}</b></p>
                    <p className="mt-1 break-words text-xs opacity-80">To: {(outsourcedEmail.to || []).join(', ') || 'Not recorded'}{outsourcedEmail.cc?.length ? ` · CC: ${outsourcedEmail.cc.join(', ')}` : ''}{outsourcedEmail.sent_at ? ` · Sent ${formatDateTime(outsourcedEmail.sent_at)}` : ''}</p>
                    {status === 'WAITING_EXTERNAL_DOCUMENTS' && <button type="button" onClick={() => void router.push('/integrations/email')} className="mt-3 inline-flex rounded-md border border-cyan-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/60 dark:hover:bg-slate-950/30">Open email integration</button>}
                  </div>
                </div>
              </div>
            )}
            {externalDocuments.length > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-4 text-sm text-slate-950 dark:border-emerald-800 dark:bg-slate-950 dark:text-slate-100">
                <p className="font-semibold">Returned files ({externalDocuments.length})</p>
                <div className="mt-3 flex flex-wrap gap-2">{externalDocuments.map((document) => <button key={document.file_key} type="button" disabled={busy} onClick={() => void downloadExternalDocument(document)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"><Download className="h-4 w-4" /> {document.filename}{document.kind ? ` · ${humanLabel(document.kind)}` : ''}</button>)}</div>
              </div>
            )}
            {sqlAccountDelivery && <div className={`mt-3 rounded-md p-3 text-sm ${sqlAccountDelivery.status === 'created' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}>
              {sqlAccountDelivery.status === 'created' ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}
              <b>SQL Account:</b> {sqlAccountDelivery.status === 'created'
                ? `created Delivery Order ${sqlAccountDelivery.delivery_order?.document_no || '—'} and Sales Invoice ${sqlAccountDelivery.invoice?.document_no || '—'}.`
                : `not posted. ${sqlAccountDelivery.detail || sqlAccountDelivery.note || 'Check the SQL Account connection and master-data matches.'}`}
              {sqlAccountDelivery.customer_creation?.customer?.code && <p className="mt-2 text-xs"><b>Customer master:</b> {sqlAccountDelivery.customer_creation.status === 'created' ? 'created' : 'already existed'} — {sqlAccountDelivery.customer_creation.customer.code} {sqlAccountDelivery.customer_creation.customer.company_name ? `(${sqlAccountDelivery.customer_creation.customer.company_name})` : ''}.</p>}
            </div>}
            {sourceWarnings.length > 0 && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <b>Extraction needs attention:</b> {sourceWarnings.join(', ').replaceAll('_', ' ')}
              </div>
            )}

            {reconciliation && reconciliation.status !== 'NOT_DECLARED' && (
              <div className={`mt-3 rounded-lg border p-4 text-sm ${reconciliation.status === 'MATCHED' ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'}`}>
                <div className="flex gap-3">
                  {reconciliation.status === 'MATCHED' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold">{reconciliation.status === 'MATCHED' ? 'Source total reconciled' : 'Source package does not reconcile yet'}</p>
                    <p className="mt-1">
                      Extracted <b>{reconciliation.currency || originalCurrency} {fmt(reconciliation.extracted_foreign_total)}</b>
                      {' · '}expected <b>{reconciliation.currency || originalCurrency} {fmt(reconciliation.expected_foreign_total)}</b>
                      {reconciliation.variance_foreign != null && Math.abs(reconciliation.variance_foreign) > 0.05 && <> · remaining variance <b>{reconciliation.currency || originalCurrency} {fmt(reconciliation.variance_foreign)}</b></>}
                    </p>
                    {waitingForDocuments && <p className="mt-1">Smartdok preserved the extracted lines and is waiting for another related document instead of replacing them with an empty fallback.</p>}
                  </div>
                </div>
              </div>
            )}

            {canReview && waitingForDocuments && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-slate-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-50">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="font-semibold">More documents required</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-amber-100">This transaction appears incomplete. If the missing document arrived as another review item, add it here. Smartdok keeps both original records for audit.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select value={combineRunId} onChange={(event) => setCombineRunId(event.target.value)} className="min-w-72 rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                    <option value="">Select the related item</option>
                    {packageCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>#{candidate.id} · {candidate.source_filename || candidate.po_label || 'Message item'}</option>)}
                  </select>
                  <button disabled={busy || !combineRunId} onClick={() => act(async () => { const result = await combineRuns(runId, Number(combineRunId)); setCombineRunId(''); return result; })} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">Add related item</button>
                </div>
              </div>
            )}
          </div>

          {canReview && (
            <section className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-5">
              <h2 className="font-semibold">Document and customer details</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Confirm the buyer details before generating. An SQL Account customer code is optional until you post to SQL Account.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Issuing company"><select value={issuingEntityKey} onChange={(event) => setIssuingEntityKey(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-slate-950 dark:bg-slate-950 dark:text-white"><option value="">Select from Knowledge Base</option>{entityProfiles.map((profile) => <option key={profile.entity_key} value={profile.entity_key}>{profile.legal_name} · {(profile.route || 'INTERNAL').toLowerCase()}{profile.role && profile.role !== 'ISSUER' ? ` · ${profile.role.toLowerCase()}` : ''}</option>)}</select></Field>
                <Field label="Customer / company name"><input value={customerDraft} onChange={(event) => setCustomerDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="SQL Account customer code"><input maxLength={10} value={customerCodeDraft} onChange={(event) => setCustomerCodeDraft(event.target.value.toUpperCase())} placeholder="Optional" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Reference code"><input value={documentCodeDraft} onChange={(event) => setDocumentCodeDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Invoice date"><input type="date" value={invoiceDateDraft} onChange={(event) => setInvoiceDateDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
              </div>
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
                {!forex && <button type="button" onClick={() => updateForex({})} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]">Add conversion rate</button>}
              </div>
              {forex ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Original currency"><input value={forex.currency || ''} onChange={(e) => updateForex({ currency: e.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Formula amount"><input type="number" value={forex.amount ?? ''} onChange={(e) => updateForex({ amount: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Operator"><select value={forex.operator || '/'} onChange={(e) => updateForex({ operator: e.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]"><option value="/">÷</option><option value="*">×</option></select></Field>
                  <Field label="Conversion rate"><input type="number" step="any" value={forex.rate ?? ''} onChange={(e) => updateForex({ rate: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Flat fee (MYR)"><input type="number" step="any" value={forex.flat_fee ?? ''} onChange={(e) => updateForex({ flat_fee: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                </div>
              ) : <p className="mt-3 text-sm text-amber-700">No conversion formula was detected. Add the rate from the WhatsApp message before you generate a foreign-currency invoice.</p>}
            </section>
          )}

          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
            <div className="p-4 border-b border-[var(--border)] font-semibold">Extracted order lines ({orderLines.length}){headingCount > 0 && <span className="font-normal text-[var(--muted-foreground)]"> + {headingCount} section heading{headingCount === 1 ? '' : 's'}</span>}{contextCount > 0 && <span className="font-normal text-[var(--muted-foreground)]"> + {contextCount} included context row{contextCount === 1 ? '' : 's'}</span>}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[var(--muted-foreground)]">
                  <th className="px-3 py-2">Product (source)</th><th className="px-3 py-2">Internal SKU <span className="font-normal">(optional)</span></th><th className="px-3 py-2">English description</th>
                  <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit ({originalCurrency})</th><th className="px-3 py-2 text-right">Amount ({originalCurrency})</th>
                  <th className="px-3 py-2 text-right">Unit (MYR)</th><th className="px-3 py-2 text-right">Amount (MYR)</th><th className="w-14 px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>{lines.map((line, index) => {
                  const descriptiveOnly = ['header', 'included_component'].includes(line.category || '');
                  return (
                  <tr key={index} className={`border-t border-[var(--border)] align-top ${line.category === 'included_component' ? 'bg-[var(--muted)]/45 text-[var(--muted-foreground)]' : ''}`}>
                    <td className="px-3 py-2"><div className={line.category === 'included_component' ? 'pl-4' : ''}>{line.category === 'included_component' ? '↳ ' : ''}{line.name}</div><div className="text-xs text-[var(--muted-foreground)]">{line.model}{line.category && <> · {humanLabel(line.category)}</>}</div></td>
                    <td className="px-3 py-2"><input disabled={!canReview || descriptiveOnly} value={line.match?.sku_code || ''} aria-label={`Internal SKU for ${line.name || `row ${index + 1}`}`} onChange={(e) => updateMatch(index, { sku_code: e.target.value })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 disabled:opacity-50" /></td>
                    <td className="px-3 py-2"><input disabled={!canReview} value={line.match?.en_description || ''} onChange={(e) => updateMatch(index, { en_description: e.target.value })} className="w-56 rounded border border-[var(--border)] bg-transparent px-2 py-1" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" value={line.qty ?? ''} onChange={(e) => updateLine(index, { qty: numeric(e.target.value) })} className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" step="any" value={line.unit_price_foreign ?? ''} onChange={(e) => updateLine(index, { unit_price_foreign: numeric(e.target.value) })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" step="any" value={line.amount_foreign ?? ''} onChange={(e) => updateLine(index, { amount_foreign: numeric(e.target.value) })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right">{fmt(line.unit_price_myr)}</td><td className="px-3 py-2 text-right">{fmt(line.amount_myr)}</td>
                    <td className="px-3 py-2 text-right">{canReview && <button type="button" onClick={() => removeLine(index)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" title={`Remove ${line.category === 'header' ? 'section heading' : 'order line'}`} aria-label={`Remove ${line.name || `row ${index + 1}`}`}><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                );})}</tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[var(--border)] text-sm flex flex-wrap gap-6 justify-end"><span>Original total: <b>{originalCurrency} {fmt(displayedTotals.amount_foreign_total)}</b></span><span>Qty total: <b>{fmt(displayedTotals.qty_total)}</b></span>{forex && <span>Flat fee: <b>RM {fmt(displayedTotals.flat_fee)}</b></span>}<span>Grand total: <b>{displayedTotals.grand_total_myr == null ? 'Pending conversion' : `RM ${fmt(displayedTotals.grand_total_myr)}`}</b></span></div>
          </div>

          {status === 'DRAFT_GENERATED' && sqlAccountDelivery?.status === 'needs_customer_approval' && customerProposal && (
            <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
              <h2 className="font-semibold">Suggested SQL Account customer</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">No high-confidence customer match was found. Review this proposal, then create it in SQL Account and retry this run. This action does not create stock items.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Customer code"><input maxLength={10} value={customerProposal.code} onChange={(event) => setCustomerProposal({ ...customerProposal, code: event.target.value.toUpperCase() })} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Company name"><input value={customerProposal.company_name} onChange={(event) => setCustomerProposal({ ...customerProposal, company_name: event.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Billing address"><textarea value={customerProposal.address || ''} onChange={(event) => setCustomerProposal({ ...customerProposal, address: event.target.value })} rows={3} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] sm:col-span-2" /></Field>
              </div>
              <button disabled={busy || customerProposal.code.trim().length < 2 || customerProposal.company_name.trim().length < 2} onClick={() => act(() => createSqlAccountCustomerAndRepush(runId, customerProposal))} className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"><Send className="h-4 w-4" /> Create customer & re-push</button>
            </section>
          )}
          {needsSqlCustomer && (
            <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
              <h2 className="font-semibold">Set SQL Account customer</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">The document did not contain a usable customer. Enter an existing SQL Account customer code, or create a reviewed customer master and immediately re-push this run.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Customer / company name"><input value={customerDraft} onChange={(event) => setCustomerDraft(event.target.value)} placeholder="e.g. COMPANY SDN BHD" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="SQL Account customer code"><input maxLength={10} value={customerCodeDraft} onChange={(event) => setCustomerCodeDraft(event.target.value.toUpperCase())} placeholder="Existing or new code" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button disabled={busy || customerCodeDraft.trim().length < 2} onClick={() => act(async () => { await reviewRun(runId, buildCorrected()); return repushRunToSqlAccount(runId); })} className="inline-flex items-center gap-2 rounded-md border border-violet-500/50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300"><Send className="h-4 w-4" /> Use existing code & re-push</button>
                <button disabled={busy || customerCodeDraft.trim().length < 2 || customerDraft.trim().length < 2} onClick={() => act(async () => { await reviewRun(runId, buildCorrected()); return createSqlAccountCustomerAndRepush(runId, { code: customerCodeDraft, company_name: customerDraft, address: '' }); })} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"><Send className="h-4 w-4" /> Create customer & re-push</button>
              </div>
            </section>
          )}
          {status === 'DRAFT_GENERATED' && sqlAccountDelivery?.status === 'needs_item_approval' && itemProposals.length > 0 && (
            <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5"><h2 className="font-semibold">Suggested SQL Account stock items</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">These products were not found in SQL Account. Review the proposed master records before creating them.</p><div className="mt-4 space-y-3">{itemProposals.map((item, index) => <div key={item.source_index} className="grid gap-3 rounded border border-[var(--border)] p-3 sm:grid-cols-[160px_1fr_100px]"><input value={item.code} onChange={(event) => setItemProposals((items) => items.map((value, current) => current === index ? { ...value, code: event.target.value.toUpperCase() } : value))} className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm" /><input value={item.description} onChange={(event) => setItemProposals((items) => items.map((value, current) => current === index ? { ...value, description: event.target.value } : value))} className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm" /><input value={item.uom || 'UNIT'} onChange={(event) => setItemProposals((items) => items.map((value, current) => current === index ? { ...value, uom: event.target.value } : value))} className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm" /></div>)}</div><button disabled={busy} onClick={() => act(() => createSqlAccountItemsAndRepush(runId, itemProposals))} className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"><Send className="h-4 w-4" /> Create items & re-push</button></section>
          )}

          <div className="flex flex-wrap gap-3">
            {status === 'PENDING_REVIEW' && <>
              <button disabled={busy} onClick={() => act(() => reviewRun(runId, buildCorrected()))} className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)]">Save corrections</button>
              <button disabled={busy} title={preparationBlocker || undefined} onClick={prepareForSql} className={`px-4 py-2 text-white rounded-md disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 ${preparationBlocker ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'}`}><FileText className="h-4 w-4" /> {isOutsourced ? 'Prepare external request' : 'Prepare for accounting approval'}</button>
              {preparationBlocker && <p className="basis-full text-sm font-medium text-amber-800"><AlertTriangle className="mr-1.5 inline h-4 w-4" />{preparationBlocker}</p>}
            </>}
            {status === 'DRAFT_GENERATED' && <>
              <button disabled={busy || !canGenerateDocuments} onClick={() => act(async () => { await reviewRun(runId, buildCorrected()); return generateRun(runId); })} className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)]">Update prepared data</button>
              {isOutsourced
                ? <button disabled={busy} onClick={() => act(() => approveRun(runId, buildCorrected()), 'Sending request to the external provider...')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:cursor-wait disabled:opacity-70 flex items-center gap-2">{busy && busyMessage?.startsWith('Sending request') ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy && busyMessage?.startsWith('Sending request') ? 'Sending email...' : 'Approve & email external provider'}</button>
                : (!sqlAccountDelivery || sqlAccountDelivery.status === 'failed' ? <button disabled={busy} onClick={() => act(() => approveRun(runId, buildCorrected()), 'Creating DO and invoice in the accounting system...')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:cursor-wait disabled:opacity-70 flex items-center gap-2">{busy && busyMessage?.startsWith('Creating DO') ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy && busyMessage?.startsWith('Creating DO') ? 'Creating in accounting...' : 'Approve & create in accounting'}</button> : null)}
            </>}
            {(status === 'PENDING_REVIEW' || status === 'DRAFT_GENERATED') && <button disabled={busy} onClick={() => act(() => rejectRun(runId, 'Rejected by reviewer'))} className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50">Reject</button>}
            {status === 'EXTERNAL_DOCUMENTS_RECEIVED' && (
              <button disabled={busy || externalDocuments.length === 0} onClick={() => act(() => sendRunToWhatsApp(runId), 'Returning external documents to WhatsApp...')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><Send className="h-4 w-4" /> Send returned documents to WhatsApp</button>
            )}
            {status === 'WAITING_EXTERNAL_DOCUMENTS' && <span className="flex items-center gap-2 text-cyan-800 dark:text-cyan-200"><Clock3 className="h-4 w-4" /> Request sent; Smartdok will collect replies from the same email thread.</span>}
            {status === 'COMPLETED' && (
              whatsappDelivery?.status === 'sent'
                ? <span className="text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Completed — {isOutsourced ? 'the external DO and invoice were returned to WhatsApp.' : 'the accounting documents were created and customer PDFs were sent to WhatsApp.'}</span>
                : whatsappDelivery?.status === 'failed'
                  ? <span className="text-amber-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {isOutsourced ? 'External documents were received' : 'Accounting documents were created'}, but WhatsApp delivery failed: {whatsappDelivery.detail || whatsappDelivery.note || 'check the bridge connection'}.</span>
                  : whatsappDelivery?.status === 'awaiting_official_documents'
                    ? <span className="text-amber-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Accounting documents were created, but customer PDF preparation is still pending.</span>
                    : <span className="text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Completed — DO and invoice created directly in SQL Accounting.</span>
            )}
            {status === 'DELIVERY_PENDING' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" /> Accounting documents were created, but the customer PDFs have not been returned to WhatsApp yet.</span>
                <button disabled={busy} onClick={() => act(() => sendRunToWhatsApp(runId))} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"><Send className="h-4 w-4" /> Prepare PDFs & send</button>
              </div>
            )}
            {status === 'COMPLETED' && whatsappDelivery?.status === 'failed' && (
              <button disabled={busy} onClick={() => act(() => sendRunToWhatsApp(runId))} className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50 flex items-center gap-2"><Send className="h-4 w-4" /> Retry WhatsApp delivery</button>
            )}
            {status === 'COMPLETED' && !isOutsourced && sqlAccountDelivery?.status !== 'created' && (
              <button disabled={busy} onClick={() => act(() => repushRunToSqlAccount(runId))} className="px-4 py-2 border border-violet-500/50 text-violet-700 rounded-md hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300 flex items-center gap-2"><Send className="h-4 w-4" /> {sqlAccountDelivery ? 'Re-push to SQL Account' : 'Push to SQL Account'}</button>
            )}
          </div>
        </div>
      )}
      {showProceedModal && (
        <ReviewConfirmationModal
          title="Proceed with an incomplete source package?"
          confirmLabel="Proceed with current document"
          tone="warning"
          busy={busy}
          onCancel={() => setShowProceedModal(false)}
          onConfirm={proceedDespiteMismatch}
        >
          <p>{preparationBlocker}</p>
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {isOutsourced ? 'The external provider request' : 'The accounting transaction'} will use the currently extracted <b>{data?.currency || ''} {fmt(displayedTotals.amount_foreign_total)}</b>, not the amount stated in the source message. This decision will be recorded in the audit activity.
          </div>
        </ReviewConfirmationModal>
      )}
      {pendingLineRemoval != null && lines[pendingLineRemoval] && (
        <ReviewConfirmationModal
          title={`Remove this ${lines[pendingLineRemoval].category === 'header' ? 'section heading' : 'order line'}?`}
          confirmLabel="Remove"
          tone="danger"
          busy={busy}
          onCancel={() => setPendingLineRemoval(null)}
          onConfirm={confirmLineRemoval}
        >
          <p><b>{lines[pendingLineRemoval].name || `Row ${pendingLineRemoval + 1}`}</b> will be removed from the reviewed transaction. Save corrections afterward to retain the change.</p>
        </ReviewConfirmationModal>
      )}
    </AppLayout>
  );
}

export default function AgentRunPage() {
  return <AutomationRunReview />;
}

function GenericWorkflowReview({
  run,
  draft,
  setDraft,
  busy,
  loading,
  error,
  act,
}: {
  run: AgentRun;
  draft: Record<string, unknown>;
  setDraft: (value: Record<string, unknown>) => void;
  busy: boolean;
  loading: boolean;
  error: string | null;
  act: (fn: () => Promise<AgentRun>) => Promise<void>;
}) {
  const router = useRouter();
  if (run.review_schema?.template_key === 'payment_knock_off') {
    return <PaymentWorkflowReview run={run} draft={draft} setDraft={setDraft} busy={busy} loading={loading} error={error} act={act} />;
  }
  const runId = run.id;
  const fields = run.review_schema?.fields || [];
  const editable = run.status === 'PENDING_REVIEW' || run.status === 'DRAFT_GENERATED';
  const issues = [run.error_message, ...run.events.filter((event) => event.event_type === 'ERROR').map((event) => event.message)].filter(Boolean) as string[];
  const configuredKeys = new Set(fields.map((field) => field.key));
  const additional = Object.entries(draft).filter(([key, value]) => !configuredKeys.has(key) && !['source', 'totals'].includes(key) && value != null);

  const update = (key: string, value: unknown) => setDraft({ ...draft, [key]: value });
  const prepare = async () => {
    await reviewRun(runId, draft as AgentRunData);
    return generateRun(runId);
  };

  return (
    <AppLayout pageName={`Review item #${runId}`}>
      <button onClick={() => router.push('/review')} className="mb-4 flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Back to Review
      </button>

      {loading && <p className="text-[var(--muted-foreground)]">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={run.status} />
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{humanLabel(run.record_type || 'workflow item')}</span>
                </div>
                <h1 className="mt-3 text-2xl font-bold text-[var(--foreground)]">{run.agent_name || `Automation #${run.agent_id}`}</h1>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{run.source_filename || run.po_label || `Run #${run.id}`} · received through {humanLabel(run.source_channel || 'unknown source')}</p>
              </div>
              <div className="text-right text-xs text-[var(--muted-foreground)]">
                <p>Run #{run.id}</p>
                <p>{formatDateTime(run.received_at)}</p>
              </div>
            </div>
            {run.source_caption && <div className="mt-4 rounded-lg bg-[var(--muted)] p-3 text-sm whitespace-pre-wrap"><b>Source message</b><p className="mt-1 text-[var(--muted-foreground)]">{run.source_caption}</p></div>}
          </section>

          {issues.length > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-semibold">Needs attention</h2>{issues.map((issue, index) => <p key={index} className="mt-1 text-sm">{issue}</p>)}</div></div></section>}

          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Extracted data</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Fields come from this automation’s data configuration. Correct only what needs human judgement.</p></div><FileText className="h-5 w-5 text-cyan-700" /></div>
            <div className="mt-5 space-y-5">
              {fields.length > 0 ? fields.map((field) => <SchemaField key={field.key} field={field} value={draft[field.key]} editable={editable} onChange={(value) => update(field.key, value)} />) : <AutoFields entries={Object.entries(draft)} editable={editable} update={update} />}
            </div>
          </section>

          {additional.length > 0 && fields.length > 0 && <details className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><summary className="cursor-pointer font-semibold">Additional extracted information</summary><div className="mt-4"><AutoFields entries={additional} editable={editable} update={update} /></div></details>}

          <section className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/95 p-4 shadow-lg backdrop-blur">
            {run.status === 'PENDING_REVIEW' && <><button disabled={busy} onClick={() => act(() => reviewRun(runId, draft as AgentRunData))} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--muted)] disabled:opacity-50">Save corrections</button><button disabled={busy} onClick={() => act(prepare)} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50">Prepare output</button></>}
            {run.status === 'DRAFT_GENERATED' && <button disabled={busy} onClick={() => act(() => approveRun(runId, draft as AgentRunData))} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> Approve & continue</button>}
            {editable && <button disabled={busy} onClick={() => act(() => rejectRun(runId, 'Rejected by reviewer'))} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>}
            {run.status === 'COMPLETED' && <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Completed</span>}
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" /> Source</h2><dl className="mt-3 space-y-2 text-sm"><Meta label="Channel" value={humanLabel(run.source_channel || '—')} /><Meta label="File" value={run.source_filename || 'Message only'} /><Meta label="Reference" value={run.source_ref || '—'} /></dl>{run.source_file_s3_key && <button onClick={async () => { const blob = await getRunSource(runId); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><Download className="h-4 w-4" /> Open original</button>}</section>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h2 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" /> Activity</h2><div className="mt-3 space-y-3">{run.events.slice().reverse().map((event) => <div key={event.id} className="flex gap-2 text-sm"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" /><div><p>{event.message || humanLabel(event.event_type)}</p><p className="text-xs text-[var(--muted-foreground)]">{formatDateTime(event.created_at)}</p></div></div>)}</div></section>
        </aside>
      </div>
    </AppLayout>
  );
}

type PaymentSlip = { source_index?: number; payment_date?: string | null; bank_reference?: string | null; payer?: string | null; amount?: number | null; currency?: string | null; payment_method_code?: string | null; confidence?: number | null; evidence_file?: string | null; unapplied_amount?: number | null };
type PaymentInvoice = { invoice_number?: string | null; stated_amount?: number | null; requested_amount?: number | null; open_balance?: number | null; status?: string | null };
type PaymentAllocation = { or_index?: number; slip_index?: number; invoice_number?: string | null; amount_to_allocate?: number | null; remaining_invoice_balance?: number | null };
type PaymentMethod = { code?: string; label?: string; bank_account?: string; is_default?: boolean };

function PaymentWorkflowReview({ run, draft, setDraft, busy, loading, error, act }: { run: AgentRun; draft: Record<string, unknown>; setDraft: (value: Record<string, unknown>) => void; busy: boolean; loading: boolean; error: string | null; act: (fn: () => Promise<AgentRun>, message?: string) => Promise<void> }) {
  const router = useRouter();
  const [varianceModal, setVarianceModal] = useState(false);
  const slips = (Array.isArray(draft.payment_slips) ? draft.payment_slips : []) as PaymentSlip[];
  const invoices = (Array.isArray(draft.requested_invoices) ? draft.requested_invoices : []) as PaymentInvoice[];
  const allocations = (Array.isArray(draft.allocations) ? draft.allocations : []) as PaymentAllocation[];
  const methods = (Array.isArray(draft.payment_methods) ? draft.payment_methods : []) as PaymentMethod[];
  const warnings = (Array.isArray(draft.warnings) ? draft.warnings : []) as string[];
  const source = (draft.source && typeof draft.source === 'object' ? draft.source : {}) as { files?: ExternalDocument[]; message?: string };
  const refs = (run.output_refs || {}) as { sql_account_payment?: { status?: string; detail?: string; note?: string; receipts?: Array<{ or_no?: string; receipt?: { or_no?: string }; status?: string; allocations?: Array<Record<string, unknown>>; invoice_allocations?: Array<Record<string, unknown>>; detail?: string }> }; sql_official_receipts?: ExternalDocument[]; notify?: { status?: string; detail?: string; note?: string; documents?: string[] } };
  const editable = ['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(run.status);
  const canApprove = run.status === 'DRAFT_GENERATED';
  const moneyText = (value?: number | null) => `RM ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayedSlipTotal = slips.reduce((sum, slip) => sum + Number(slip.amount || 0), 0);
  const displayedInvoiceTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.requested_amount ?? invoice.stated_amount ?? 0), 0);
  const displayedAllocatedTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amount_to_allocate || 0), 0);
  const displayedUnappliedTotal = displayedSlipTotal - displayedAllocatedTotal;
  const updateSlips = (next: PaymentSlip[]) => setDraft({ ...draft, payment_slips: next });
  const updateInvoices = (next: PaymentInvoice[]) => setDraft({ ...draft, requested_invoices: next });
  const updateAllocations = (next: PaymentAllocation[]) => setDraft({ ...draft, allocations: next, allocation_override: next });
  const prepare = async (value = draft) => { await reviewRun(run.id, value as AgentRunData); return generateRun(run.id); };
  const requestPrepare = () => {
    if (displayedUnappliedTotal > 0.005 && !((draft.review_override as Record<string, unknown> | undefined)?.accept_unapplied)) setVarianceModal(true);
    else void act(() => prepare());
  };
  const acceptVariance = () => {
    const next = { ...draft, review_override: { ...((draft.review_override as Record<string, unknown>) || {}), accept_unapplied: true, reason: 'Authorized reviewer accepted the displayed variance as unapplied customer credit.' } };
    setDraft(next); setVarianceModal(false); void act(() => prepare(next));
  };

  return <AppLayout pageName={`Payment review #${run.id}`}><div className="space-y-5">
    <button onClick={() => router.push('/review')} className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Back to Review</button>
    {loading && <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading payment bundle…</div>}
    {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
    {busy && <div role="status" className="flex items-center gap-3 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm font-semibold text-cyan-950"><LoaderCircle className="h-5 w-5 animate-spin" /> Smartdok is checking live SQL Accounting data. Posting can take up to a minute.</div>}

    <header className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><StatusPill status={run.status} /><span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Payment knock-off</span></div><h1 className="mt-3 text-2xl font-bold">{draft.customer ? String(draft.customer) : 'Customer payment'}</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">{draft.customer_code ? `SQL customer ${String(draft.customer_code)}` : 'Customer still needs a live SQL match'} · {slips.length} payment slip{slips.length === 1 ? '' : 's'}</p></div><div className="text-right text-xs text-[var(--muted-foreground)]"><p>Run #{run.id}</p><p>{formatDateTime(run.received_at)}</p></div></div>{source.message && <div className="mt-4 rounded-xl bg-[var(--muted)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">SLIP UPDATE instruction</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{source.message}</p></div>}</header>

    <section className="grid gap-3 sm:grid-cols-4"><Metric label="Slip total" value={moneyText(displayedSlipTotal)} /><Metric label="Requested invoices" value={moneyText(displayedInvoiceTotal)} /><Metric label="Allocated" value={moneyText(displayedAllocatedTotal)} /><Metric label="Unapplied / variance" value={moneyText(displayedUnappliedTotal)} warning={Math.abs(displayedUnappliedTotal) > 0.005} /></section>

    {(warnings.length > 0 || run.error_message) && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-semibold">Review required</h2>{[run.error_message, ...warnings].filter(Boolean).map((warning, index) => <p key={index} className="mt-1 text-sm">{warning}</p>)}</div></div></section>}

    {source.files && source.files.length > 0 && <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h2 className="font-semibold">Payment-slip evidence</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Each slip remains attached to this audit record.</p><div className="mt-4 grid gap-4 md:grid-cols-2">{source.files.map((file) => <PaymentEvidence key={file.file_key} runId={run.id} file={file} />)}</div></section>}

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div><h2 className="font-semibold">Extracted payments</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Bank reference, date and amount come from each slip. Choose a saved mapping or enter the exact SQL payment-method code immediately before posting.</p></div><datalist id="sql-payment-method-codes">{methods.map((method) => <option key={method.code} value={method.code}>{method.label || method.code}{method.bank_account ? ` · ${method.bank_account}` : ''}</option>)}</datalist><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[var(--muted)]"><tr>{['Slip', 'Payment date', 'Bank reference', 'Payer', 'Amount', 'SQL payment method'].map((label) => <th key={label} className="px-3 py-2 text-left">{label}</th>)}</tr></thead><tbody>{slips.map((slip, index) => <tr key={index} className="border-t border-[var(--border)]"><td className="px-3 py-2 font-semibold">OR {index + 1}</td><td className="px-2 py-2"><GenericInput value={slip.payment_date} type="DATE" disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, payment_date: String(value || '') } : row))} /></td><td className="px-2 py-2"><GenericInput value={slip.bank_reference} disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, bank_reference: String(value || '') } : row))} /></td><td className="px-2 py-2"><GenericInput value={slip.payer} disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, payer: String(value || '') } : row))} /></td><td className="px-2 py-2"><GenericInput value={slip.amount} type="MONEY" disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, amount: Number(value || 0) } : row))} /></td><td className="px-2 py-2"><input list="sql-payment-method-codes" disabled={!editable} value={slip.payment_method_code || methods.find((item) => item.is_default)?.code || ''} onChange={(event) => updateSlips(slips.map((row, position) => position === index ? { ...row, payment_method_code: event.target.value } : row))} placeholder="Choose or enter SQL code" className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2" /></td></tr>)}</tbody></table></div></section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h2 className="font-semibold">Live invoices and requested amounts</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-[var(--muted)]"><tr><th className="px-3 py-2 text-left">Invoice</th><th className="px-3 py-2 text-right">Message amount</th><th className="px-3 py-2 text-right">Live open balance</th><th className="px-3 py-2 text-right">Amount to knock off</th></tr></thead><tbody>{invoices.map((invoice, index) => <tr key={invoice.invoice_number || index} className="border-t border-[var(--border)]"><td className="px-3 py-3 font-semibold">{invoice.invoice_number || 'Missing invoice number'}</td><td className="px-3 py-3 text-right">{moneyText(invoice.stated_amount)}</td><td className="px-3 py-3 text-right">{invoice.open_balance == null ? <span className="font-semibold text-red-700">Not found / closed</span> : moneyText(invoice.open_balance)}</td><td className="px-2 py-2"><GenericInput value={invoice.requested_amount} type="MONEY" disabled={!editable} onChange={(value) => updateInvoices(invoices.map((row, position) => position === index ? { ...row, requested_amount: Number(value || 0) } : row))} /></td></tr>)}</tbody></table></div></section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h2 className="font-semibold">Proposed Customer Payments / ORs</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">One OR per slip. Allocations follow slip order and message invoice order; a slip boundary may split an invoice.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{slips.map((slip, slipIndex) => { const rows = allocations.filter((item) => Number(item.or_index) === slipIndex + 1); const allocated = rows.reduce((sum, item) => sum + Number(item.amount_to_allocate || 0), 0); return <article key={slipIndex} className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">OR {slipIndex + 1}</p><p className="text-xs text-[var(--muted-foreground)]">{slip.bank_reference || 'Reference required'} · {slip.payment_date || 'date required'}</p></div><p className="font-bold">{moneyText(slip.amount)}</p></div><div className="mt-3 space-y-2">{rows.map((allocation) => { const originalIndex = allocations.indexOf(allocation); return <div key={`${allocation.invoice_number}-${originalIndex}`} className="grid grid-cols-[1fr_140px] items-center gap-3 rounded-lg bg-[var(--muted)]/60 p-3"><div><p className="text-sm font-semibold">{allocation.invoice_number}</p><p className="text-xs text-[var(--muted-foreground)]">Remaining {moneyText(allocation.remaining_invoice_balance)}</p></div><GenericInput value={allocation.amount_to_allocate} type="MONEY" disabled={!editable} onChange={(value) => updateAllocations(allocations.map((row, index) => index === originalIndex ? { ...row, amount_to_allocate: Number(value || 0) } : row))} /></div>; })}</div><div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-sm"><span>Allocated</span><b>{moneyText(allocated)}</b></div></article>; })}</div></section>

    {refs.sql_account_payment && <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Posting results</h2><StatusPill status={refs.sql_account_payment.status || 'pending'} /></div>{refs.sql_account_payment.status !== 'created' && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">{refs.sql_account_payment.detail || refs.sql_account_payment.note || 'SQL Accounting did not create the receipt.'}</p>}<div className="mt-3 space-y-2">{(refs.sql_account_payment.receipts || []).map((receipt, index) => { const orNo = receipt.receipt?.or_no || receipt.or_no; const allocationCount = receipt.allocations?.length || receipt.invoice_allocations?.length || 0; return <div key={orNo || index} className="flex items-center justify-between rounded-lg bg-[var(--muted)] p-3 text-sm"><span><b>{orNo || `OR ${index + 1}`}</b><span className="ml-2 text-[var(--muted-foreground)]">{receipt.detail || `${allocationCount} invoice allocation(s)`}</span></span><span className="font-semibold">{receipt.status || 'created'}</span></div>; })}</div>{refs.sql_official_receipts && refs.sql_official_receipts.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{refs.sql_official_receipts.map((file) => <PaymentEvidence key={file.file_key} runId={run.id} file={file} />)}</div>}{refs.notify && <p className={`mt-3 rounded-lg p-3 text-sm ${refs.notify.status === 'sent' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>{refs.notify.status === 'sent' ? 'Official SQL OR PDFs were returned to the originating WeChat group.' : `Delivery pending: ${refs.notify.detail || refs.notify.note || 'official PDF is not available yet'}`}</p>}</section>}

    <section className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/95 p-4 shadow-lg backdrop-blur">{run.status === 'PENDING_REVIEW' && <><button disabled={busy} onClick={() => void act(() => reviewRun(run.id, draft as AgentRunData))} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Save corrections</button><button disabled={busy} onClick={requestPrepare} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Validate payment knock-off</button></>}{canApprove && <button disabled={busy} onClick={() => void act(() => approveRun(run.id, draft as AgentRunData), 'Posting the approved receipt to SQL Accounting...')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {busy ? 'Posting receipt...' : `Approve & post ${slips.length} receipt${slips.length === 1 ? '' : 's'}`}</button>}{run.status === 'DELIVERY_PENDING' && <button disabled={busy} onClick={() => void act(() => retryRunDelivery(run.id))} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Retry PDF delivery</button>}{editable && <button disabled={busy} onClick={() => void act(() => rejectRun(run.id, 'Rejected by payment reviewer'))} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>}{run.status === 'COMPLETED' && <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Posted and returned to WeChat</span>}</section>
  </div>{varianceModal && <ReviewConfirmationModal title="Accept unapplied customer credit?" confirmLabel="Accept variance & prepare" tone="warning" busy={busy} onCancel={() => setVarianceModal(false)} onConfirm={acceptVariance}><p>The slips exceed the selected invoice allocations by <b>{moneyText(displayedUnappliedTotal)}</b>. Continuing records an explicit reviewer override and allows SQL Accounting to retain this amount as unapplied customer credit. It will never be accepted silently.</p></ReviewConfirmationModal>}</AppLayout>;
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className={`rounded-xl border p-4 ${warning ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-[var(--border)] bg-[var(--card)]'}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>; }

function PaymentEvidence({ runId, file }: { runId: number; file: ExternalDocument }) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState(file.content_type || '');
  useEffect(() => { let active = true; let objectUrl: string | null = null; getRunFile(runId, file.file_key).then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); setMime(blob.type || file.content_type || ''); }).catch(() => undefined); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [runId, file.file_key, file.content_type]);
  return <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]/40">{url && mime.startsWith('image/') ? <img src={url} alt={file.filename} className="h-56 w-full object-contain bg-white" /> : <div className="flex h-40 items-center justify-center bg-[var(--muted)]"><FileText className="h-10 w-10 text-[var(--muted-foreground)]" /></div>}<div className="flex items-center justify-between gap-3 p-3"><span className="truncate text-sm font-semibold">{file.filename}</span>{url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700"><Download className="h-3.5 w-3.5" /> Open</a>}</div></article>;
}

function SchemaField({ field, value, editable, onChange }: { field: ReviewFieldDefinition; value: unknown; editable: boolean; onChange: (value: unknown) => void }) {
  if (field.structure === 'TABLE' || Array.isArray(value)) {
    const rows = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
    const columns = field.children?.length ? field.children : inferColumns(rows);
    return <div><div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">{field.label || humanLabel(field.key)}{field.required && <span className="ml-1 text-red-500">*</span>}</h3>{field.description && <p className="text-xs text-[var(--muted-foreground)]">{field.description}</p>}</div>{editable && <button type="button" onClick={() => onChange([...rows, Object.fromEntries(columns.map((column) => [column.key, null]))])} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--muted)]"><Plus className="h-3.5 w-3.5" /> Add row</button>}</div><div className="overflow-x-auto rounded-lg border border-[var(--border)]"><table className="w-full min-w-[680px] text-sm"><thead className="bg-[var(--muted)]"><tr>{columns.map((column) => <th key={column.key} className="px-3 py-2 text-left font-medium">{column.label || humanLabel(column.key)}</th>)}{editable && <th className="w-12 px-2 py-2"><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[var(--border)]">{columns.map((column) => <td key={column.key} className="px-2 py-2"><GenericInput value={row[column.key]} type={column.type} disabled={!editable} onChange={(next) => onChange(rows.map((current, index) => index === rowIndex ? { ...current, [column.key]: next } : current))} /></td>)}{editable && <td className="px-2 py-2"><button type="button" onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Remove row"><Trash2 className="h-4 w-4" /></button></td>}</tr>)}</tbody></table>{rows.length === 0 && <p className="p-4 text-sm text-[var(--muted-foreground)]">No rows were extracted.</p>}</div></div>;
  }
  return <Field label={`${field.label || humanLabel(field.key)}${field.required ? ' *' : ''}`}><GenericInput value={value} type={field.type} disabled={!editable} onChange={onChange} /></Field>;
}

function AutoFields({ entries, editable, update }: { entries: Array<[string, unknown]>; editable: boolean; update: (key: string, value: unknown) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">{entries.map(([key, value]) => Array.isArray(value) || (value && typeof value === 'object') ? <div key={key} className="sm:col-span-2"><SchemaField field={{ key, label: humanLabel(key), structure: Array.isArray(value) ? 'TABLE' : 'SCALAR' }} value={value} editable={editable} onChange={(next) => update(key, next)} /></div> : <SchemaField key={key} field={{ key, label: humanLabel(key) }} value={value} editable={editable} onChange={(next) => update(key, next)} />)}</div>;
}

function GenericInput({ value, type, disabled, onChange }: { value: unknown; type?: string; disabled: boolean; onChange: (value: unknown) => void }) {
  if (value && typeof value === 'object') return <pre className="max-h-48 overflow-auto rounded bg-[var(--muted)] p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>;
  const normalizedType = (type || '').toUpperCase();
  if (normalizedType === 'BOOLEAN' || typeof value === 'boolean') return <input type="checkbox" disabled={disabled} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="mt-2 h-4 w-4 rounded border-[var(--border)]" />;
  const inputType = normalizedType === 'DATE' ? 'date' : ['NUMBER', 'MONEY'].includes(normalizedType) || typeof value === 'number' ? 'number' : 'text';
  return <input type={inputType} step={inputType === 'number' ? 'any' : undefined} disabled={disabled} value={value == null ? '' : String(value)} onChange={(event) => onChange(inputType === 'number' ? numeric(event.target.value) : event.target.value)} className="mt-1 w-full min-w-28 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-2 text-sm text-[var(--foreground)] disabled:bg-[var(--muted)] disabled:opacity-80" />;
}

function inferColumns(rows: Array<Record<string, unknown>>): ReviewFieldDefinition[] {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 12).map((key) => ({ key, label: humanLabel(key) }));
}

function humanLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString() : '—'; }
function StatusPill({ status }: { status: string }) { const tone = status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : status === 'FAILED' ? 'bg-red-100 text-red-800' : status === 'DRAFT_GENERATED' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-900'; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{humanLabel(status)}</span>; }
function Meta({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[80px_1fr] gap-2"><dt className="text-[var(--muted-foreground)]">{label}</dt><dd className="break-words font-medium">{value}</dd></div>; }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-xs text-[var(--muted-foreground)]">{label}{children}</label>;
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

interface OutsourcedEmailDelivery {
  status?: string;
  thread_id?: number;
  subject?: string;
  to?: string[];
  cc?: string[];
  sent_at?: string | null;
  reply_received_at?: string | null;
  expected_attachments?: Array<{ type?: string; required?: boolean }>;
}

interface ExternalDocument {
  filename: string;
  file_key: string;
  kind?: string;
  content_type?: string;
  size?: number;
}

function ReviewConfirmationModal({
  title,
  confirmLabel,
  tone,
  busy,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  tone: 'warning' | 'danger';
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-amber-600 hover:bg-amber-700';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => !busy && onCancel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="review-confirmation-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${tone === 'danger' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}><AlertTriangle className="h-5 w-5" /></div>
            <div><h2 id="review-confirmation-title" className="text-lg font-semibold">{title}</h2><div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{children}</div></div>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-50" aria-label="Close confirmation"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--muted)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
