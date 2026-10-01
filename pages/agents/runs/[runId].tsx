'use client';

import { ReservedDoReview } from '@/components/automation/ReservedDoReview';

import { editOrderLine } from '../../../utils/orderLineEdit';

import { appendPaymentEvidence, paymentFilesForMessage } from '../../../utils/paymentEvidenceFiles';
import { AppLayout } from '@/components/layout';
import { PaymentResolutionActions } from '@/components/automation/PaymentResolutionActions';
import { PaymentSubmitProgress } from '@/components/automation/PaymentSubmitProgress';
import { PaymentAutoKnockoff } from '@/components/automation/PaymentAutoKnockoff';
import { submitPayment } from '@/services/AgentsService';
import { PaymentInvoiceFollowup } from '@/components/automation/PaymentInvoiceFollowup';
import { PaymentInvoiceIssuance } from '@/components/automation/PaymentInvoiceIssuance';
import { setInvoiceWaitApproval } from '@/services/AgentsService';
import { PaymentEvidenceSummary } from '@/components/automation/PaymentEvidenceSummary';
import { OrderSSTConfirmation } from '@/components/automation/OrderSSTConfirmation';
import { SqlItemResolution } from '@/components/automation/SqlItemResolution';
import { applySqlItemBatches } from '@/utils/sqlItemBatch';
import { OrderBatchActions } from '@/components/automation/OrderBatchActions';
import { startOrderBatch } from '@/services/AgentsService';
import { requiresOrderCustomerSelection } from '@/utils/orderCustomerConfirmation';
import { paymentSqlCheckStatus } from '@/services/AgentsService';
import { readPaymentSqlProgress, paymentSqlJobRunning } from '@/utils/paymentSqlJob';
import {
  AutomationStatusBadge,
  inferApprovalDestination,
  type ApprovalDestination,
} from '@/components/automation/AutomationStatus';
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ArrowLeft, CheckCircle2, AlertTriangle, FileText, Send, Download, FileSpreadsheet, Image as ImageIcon, Clock3, History, Inbox, ShieldCheck, Plus, Trash2, X, LoaderCircle, RefreshCw, UploadCloud } from 'lucide-react';
import {
  getRun, getRunSource, getRunFile, reviewRun, reanalyzeRun, refreshPaymentPreview, addPaymentEvidence, generateRun, updateRunDocumentNumbers, approveRun, retryRunDelivery, sendRunToWhatsApp, verifySupplierDocuments, skipSupplierVerification, repushRunToSqlAccount, createSqlAccountCustomerAndRepush, resolveSqlAccountItems, checkSqlAccountItems, rejectRun, listRuns, combineRuns,
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

function explainSqlAccountError(message?: string | null) {
  const text = String(message || '').trim();
  if (!text) return text;
  if (/invalid UOM|Please select a valid UOM|blank UOM|UOM\.AsString empty|UOM\.Value=NULL/i.test(text)) {
    return 'SQL did not accept this line unit. Keep the source unit; check the selected item or choose a free-text line. No UNIT conversion should be assumed.\n\n' + text;
  }
  return text;
}

const normalizeRunLine = (value: unknown): AgentRunLine => {
  const line = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const rawMatch = (line.match && typeof line.match === 'object' ? line.match : {}) as Record<string, unknown>;
  return {
    ...line,
    name: String(line.name ?? line.source_description ?? line.description ?? ''),
    more_description: (line.more_description ?? null) as string | null,
    model: String(line.model ?? line.model_or_part_number ?? line.item_code ?? ''),
    unit: (line.unit ?? line.uom ?? undefined) as string | undefined,
    source_unit: (line.source_unit ?? null) as string | null,
    color: (line.color ?? line.colour ?? null) as string | null,
    source_color: (line.source_color ?? line.source_colour ?? null) as string | null,
    qty: (line.qty ?? line.quantity ?? null) as number | null,
    category: (line.category ?? line.line_category ?? null) as string | null,
    unit_price_foreign: (line.unit_price_foreign ?? null) as number | null,
    amount_foreign: (line.amount_foreign ?? line.line_amount_foreign ?? null) as number | null,
    unit_price_myr: (line.unit_price_myr ?? line.converted_unit_price_myr ?? null) as number | null,
    amount_myr: (line.amount_myr ?? line.converted_line_amount_myr ?? null) as number | null,
    match: {
      ...rawMatch,
      matched: Boolean(rawMatch.matched ?? line.matched_internal_sku),
      confidence: Number(rawMatch.confidence ?? (line.matched_internal_sku ? 1 : 0)),
      sku_code: (rawMatch.sku_code ?? line.matched_internal_sku ?? null) as string | null,
      en_description: (line.line_mapping_mode === 'PART_NO_DESCRIPTION' ? line.source_description : (rawMatch.en_description ?? line.english_description ?? null)) as string | null,
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
  // Next retains page instances between dynamic routes. Every draft, pending
  // request and child editor must belong to one review for its entire lifetime.
  const runId = Number(router.query.runId);
  return <AutomationRunReviewSession key={runId} reviewMode={reviewMode} />;
}

function AutomationRunReviewSession({ reviewMode = false }: { reviewMode?: boolean }) {
  const router = useRouter();
  const runId = Number(router.query.runId);

  const [run, setRun] = useState<AgentRun | null>(null);
  const manualClosure = run?.output_refs?.manual_order_closure as { reason_code?: string; canonical_run_id?: number } | undefined;
  const [lines, setLines] = useState<AgentRunLine[]>([]);
  const [forexDraft, setForexDraft] = useState<AgentRunForex | null>(null);
  const [noConversion, setNoConversion] = useState(false);
  const [customerDraft, setCustomerDraft] = useState('');
  const [customerCodeDraft, setCustomerCodeDraft] = useState('');
  const [documentCodeDraft, setDocumentCodeDraft] = useState('');
  const [deliveryOrderNumberDraft, setDeliveryOrderNumberDraft] = useState('');
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState('');
  const [sourceReferenceDraft, setSourceReferenceDraft] = useState('');
  const [invoiceDateDraft, setInvoiceDateDraft] = useState('');
  const [paymentTermsDraft, setPaymentTermsDraft] = useState('');
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
  const liveDraftRef = useRef(genericDraft);
  liveDraftRef.current = genericDraft;
  const [analysisNotice, setAnalysisNotice] = useState('');
  const [sqlJobState, setSqlJobState] = useState({id:'', status:'', notice:''});
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
    setNoConversion(Boolean(reviewed?.no_conversion) || String(reviewed?.currency || '').toUpperCase() === 'MYR');
    setCustomerDraft(reviewed?.customer || '');
    setCustomerCodeDraft(reviewed?.customer_code || '');
    setDocumentCodeDraft(reviewed?.code || '');
    setSourceReferenceDraft(reviewed?.source_reference || '');
    setInvoiceDateDraft(reviewed?.inv_date || '');
    setPaymentTermsDraft(reviewed?.payment_terms || '');
    const reservedNumbers = (r.output_refs as { accounting_request?: { reservation_only?: boolean; delivery_order_no?: string | null; invoice_no?: string | null; invoice_number_source?: string | null } } | undefined)?.accounting_request;
    setDeliveryOrderNumberDraft(reservedNumbers?.delivery_order_no || '');
    setInvoiceNumberDraft(reservedNumbers?.invoice_no || '');
    setIssuingEntityKey(reviewed?.issuing_entity?.entity_key || reviewed?.issuing_entity?.key || '');
    const proposal = (r.output_refs as { sql_account?: { customer_proposal?: SqlAccountCustomerProposal } } | undefined)?.sql_account?.customer_proposal;
    setCustomerProposal(proposal?.code && proposal.code.length <= 10 && proposal.company_name ? { code: proposal.code, company_name: proposal.company_name, address: proposal.address || '' } : null);
    setItemProposals((r.output_refs as { sql_account?: { item_proposals?: SqlAccountStockItemProposal[] } } | undefined)?.sql_account?.item_proposals || []);
  };

  const load = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const loaded = await getRun(runId);
      hydrate(loaded);
      const paymentData = loaded.corrected_data || loaded.extracted_data;
      const hasPaymentMethods = Array.isArray(paymentData?.payment_methods) && paymentData.payment_methods.length > 0;
      const hasSqlCheck = Boolean((paymentData?.sql_preview as { status?: string } | undefined)?.status);
      const awaitingInstruction = loaded.awaiting_instruction
        || Boolean((loaded.output_refs as { awaiting_instruction?: boolean } | null)?.awaiting_instruction);
      // Reopening a failed review must not silently enqueue another SQL check.
      // Keep its last result visible until the reviewer chooses Retry SQL check.
      if (loaded.review_schema?.template_key === 'payment_knock_off' && ['PENDING_REVIEW','DRAFT_GENERATED'].includes(loaded.status) && !awaitingInstruction && !hasPaymentMethods && !hasSqlCheck) {
        void refreshPaymentPreview(runId)
          .then((refreshed) => { hydrate(refreshed); setError(null); })
          .catch((refreshError) => setError((refreshError as Error)?.message || 'Could not refresh SQL payment methods'));
      }
      if (loaded.review_schema?.template_key !== 'payment_knock_off') setError(null);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  const sqlJobId=String(run?.output_refs?.payment_sql_job_id||'');
  const sqlCheckRunning=paymentSqlJobRunning(sqlJobId,sqlJobState);
  const sqlJobNotice=sqlJobState.id===sqlJobId && sqlJobId ? sqlJobState.notice : analysisNotice;
  useEffect(()=>{
    if(!runId||!sqlJobId)return;
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    const initial=JSON.stringify(liveDraftRef.current);
    let unavailableAttempts=0;
    const poll=async()=>{
      const result=await readPaymentSqlProgress(sqlJobId,()=>paymentSqlCheckStatus(runId),()=>getRun(runId));
      if(!active)return;
      if(result.follow && result.updated){setRun(result.updated);return;}
      const unsaved=JSON.stringify(liveDraftRef.current)!==initial;
      if(result.updated){
        if(!unsaved)hydrate(result.updated);else setRun(result.updated);
      }
      const unavailable=result.job.status==='UNAVAILABLE';
      unavailableAttempts=unavailable ? unavailableAttempts+1 : 0;
      const exhausted=unavailableAttempts>=3;
      setSqlJobState({id:sqlJobId,status:result.job.status,notice:result.notice
        +(exhausted ? ' Automatic status retries stopped. Reload or retry the read-only check.' : '')
        +(result.updated && unsaved ? ' Your unsaved edits are preserved; save them before checking again.' : '')});
      if(result.retry && !exhausted){
        timer=setTimeout(poll,unavailable ? 3000 : 2000);
      }
    };
    void poll();
    return()=>{active=false;clearTimeout(timer);};
  },[runId,sqlJobId]);

  const paymentExtracting=run?.review_schema?.template_key==='payment_knock_off'&&run?.status==='EXTRACTING';
  useEffect(()=>{
    if(!runId||!paymentExtracting)return;
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    const initial=JSON.stringify(liveDraftRef.current);
    const poll=async()=>{
      try {
        const updated=await getRun(runId);
        if(!active)return;
        if(updated.status==='EXTRACTING'){
          setAnalysisNotice('付款资料正在后台分析，可以离开处理其他 Case。');
          timer=setTimeout(poll,2500);return;
        }
        if(JSON.stringify(liveDraftRef.current)===initial)hydrate(updated);else setRun(updated);
        setAnalysisNotice('后台分析已结束，请核对资料和处理状态。');
      }catch(e){if(active){setAnalysisNotice('暂时无法读取后台进度，正在重新检查。');timer=setTimeout(poll,5000);}}
    };
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[runId,paymentExtracting]);

  const loadedRunId = run?.id;
  const loadedTemplateKey = run?.review_schema?.template_key;

  useEffect(() => {
    if (!loadedRunId || loadedTemplateKey === 'payment_knock_off') return undefined;
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
  }, [loadedRunId, loadedTemplateKey]);

  useEffect(() => {
    if (!run?.agent_id || run.review_schema?.template_key === 'payment_knock_off') return;
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
  }, [run?.agent_id, run?.id, run?.review_schema?.template_key]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!runId || !run?.source_file_s3_key || run.review_schema?.template_key === 'payment_knock_off') {
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
  }, [runId, run?.source_file_s3_key, run?.review_schema?.template_key]);

  const data: AgentRunData | undefined = run?.corrected_data || run?.extracted_data || undefined;
  const approvalDestination = inferApprovalDestination(
    data as unknown as Record<string, unknown> | undefined,
    run?.review_schema?.template_key,
  );
  const forex = forexDraft;
  const totals = data?.totals || {};
  const salesTax = data?.sales_tax as { customer_group?: string | null; applied?: boolean; rate?: number; tax_code?: string | null } | undefined;
  const conversion = data?.conversion;
  const whatsappDelivery = (run?.output_refs as { notify?: { status?: string; detail?: string; note?: string; group_jid?: string; group_name?: string } } | undefined)?.notify;
  const customerWhatsAppGroup = String(
    whatsappDelivery?.group_name
    || (run?.output_refs as { source_group_name?: string } | undefined)?.source_group_name
    || (run?.output_refs as { source_channel_ref?: string } | undefined)?.source_channel_ref
    || 'Not available',
  );
  const customerWhatsAppJid = String(
    whatsappDelivery?.group_jid
    || (run?.output_refs as { source_channel_ref?: string } | undefined)?.source_channel_ref
    || '',
  );
  const sqlAccountDelivery = (run?.output_refs as { sql_account?: SqlAccountDelivery } | undefined)?.sql_account;
  const accountingRequest = (run?.output_refs as { accounting_request?: { reservation_only?: boolean; delivery_order_no?: string | null; invoice_no?: string | null; invoice_number_source?: string | null } } | undefined)?.accounting_request;
  const requestedDocumentTypes = (run?.output_refs as { requested_document_types?: string[] } | undefined)?.requested_document_types || (run?.corrected_data || run?.extracted_data)?.requested_document_types;
  const invoiceOnly = Array.isArray(requestedDocumentTypes) && requestedDocumentTypes.length === 1 && requestedDocumentTypes[0] === "invoice";
  const sqlAutoInvoiceNumber = String(accountingRequest?.invoice_number_source || '').toUpperCase() === 'SQL_AUTO';
  const deliveryOrderNumber = sqlAccountDelivery?.delivery_order?.document_no || accountingRequest?.delivery_order_no;
  const invoiceNumber = sqlAccountDelivery?.invoice?.document_no || accountingRequest?.invoice_no;
  const sqlDocumentsCreated = sqlAccountDelivery?.status === 'created';
  const agentExecution = (run?.output_refs as { agent_execution?: { status?: string; detail?: string; plan?: { summary?: string; authority?: string; steps?: Array<{ sequence: number; tool: string; purpose: string; requires_approval?: boolean }>; warnings?: string[] }; tool_results?: Array<{ tool: string; status: string; detail: string }> } } | undefined)?.agent_execution;
  const outsourcedEmail = (run?.output_refs as { outsourced_email?: OutsourcedEmailDelivery } | undefined)?.outsourced_email;
  const outsourcedWhatsApp = (run?.output_refs as { outsourced_whatsapp?: OutsourcedWhatsAppDelivery } | undefined)?.outsourced_whatsapp;
  const supplierPreview = (run?.output_refs as { outsource_request_preview?: {
    attachment_file_key?: string; attachment_filename?: string; attachment_currency?: string;
  } } | undefined)?.outsource_request_preview;
  const generatedDocuments = ((run?.output_refs as { pdf_documents?: Array<ExternalDocument & { word_file_key?: string; word_filename?: string }> } | undefined)?.pdf_documents || []).flatMap((file) => [file, ...(file.word_file_key ? [{ filename: file.word_filename || 'document.docx', file_key: file.word_file_key, kind: 'Word' }] : [])]);
  const externalDocuments = (run?.output_refs as { external_documents?: ExternalDocument[] } | undefined)?.external_documents || [];
  const supportingSourceFiles = (run?.output_refs as {
    supporting_source_files?: Array<{
      source_run_id: number;
      filename?: string | null;
      reason?: string | null;
      confidence?: number | null;
    }>;
  } | undefined)?.supporting_source_files || [];
  const supplierVerification = (run?.output_refs as { supplier_document_verification?: SupplierDocumentVerification } | undefined)?.supplier_document_verification;
  const failedVerificationChecks = (supplierVerification?.documents || []).flatMap((document) => document.checks || []).filter((check) => check.status === 'FAILED');
  const returnedDocumentKinds = new Set(externalDocuments.map((document) => String(document.kind || '').toUpperCase()));
  const missingExternalAttachmentLabels = (outsourcedEmail?.expected_attachments || [])
    .filter((attachment) => attachment.required !== false && attachment.type && !returnedDocumentKinds.has(attachment.type.toUpperCase()))
    .map((attachment) => attachment.label || humanLabel(attachment.type || 'document'));
  const externalPackageComplete = missingExternalAttachmentLabels.length === 0;
  const sourceWarnings = (data?.source?.warnings as string[] | undefined) || [];
  const aiExtraction = (
    (run?.output_refs as { ai_extraction?: Record<string, unknown> } | undefined)?.ai_extraction
    || (data?.source?.ai as Record<string, unknown> | undefined)
  );
  const aiExtractionStatus = String(aiExtraction?.status || '').toUpperCase();
  const aiExtractionNeedsAttention = ['FAILED', 'RECOVERED'].includes(aiExtractionStatus);
  const reconciliation = data?.reconciliation;
  const workPackage = data?.package;
  const selectedIssuingEntity = entityProfiles.find((profile) => profile.entity_key === issuingEntityKey);
  const fulfilmentRoute = String(selectedIssuingEntity?.route || selectedIssuingEntity?.fulfilment_mode || data?.fulfilment_route || data?.issuing_entity?.fulfilment_mode || 'INTERNAL').toUpperCase();
  const bundle = run?.bundle;
  const isOutsourced = fulfilmentRoute === 'OUTSOURCED';
  const outsourcedChannel = String(data?.issuing_entity?.outbound_channel || '').toUpperCase();
  const orderLines = lines.filter((line) => !['header', 'included_component'].includes(line.category || ''));
  const headingCount = lines.filter((line) => line.category === 'header').length;
  const contextCount = lines.length - orderLines.length - headingCount;
  const hasAllSourceAmounts = orderLines.length > 0 && orderLines.every((line) => line.amount_foreign != null);
  const hasAllMyrAmounts = orderLines.length > 0 && orderLines.every((line) => line.amount_myr != null);
  const hasEffectiveMyrAmounts = hasAllMyrAmounts || (noConversion && hasAllSourceAmounts);
  const waitingForDocuments = ['WAITING_FOR_DOCUMENTS', 'NEEDS_REVIEW'].includes(workPackage?.status || '');
  const canGenerateDocuments = (isOutsourced || hasEffectiveMyrAmounts) && !waitingForDocuments;
  const historicalLookup = data?.source?.latest_invoice_lookup as {status?: string; note?: string} | undefined;
  const preparationBlocker = lines.length === 0
    ? (historicalLookup?.note || 'No order lines were retrieved. Check the source description or retry the historical invoice lookup; no exchange rate is needed to fix missing lines.')
    : waitingForDocuments
    ? `Check the source grouping: the message expects ${workPackage?.expected_set_count || 'separate'} document sets; ${workPackage?.received_primary_document_count || 1} transaction(s) were identified. ${Number(workPackage?.remaining_foreign_total || 0) > 0 ? `${data?.currency || ''} ${fmt(workPackage?.remaining_foreign_total)} is still missing. ` : 'A matching total does not confirm the grouping. '}Re-analyze the source or review the discrepancy before proceeding.`
    : !isOutsourced && !hasEffectiveMyrAmounts
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
    source_reference: sourceReferenceDraft.trim() || null,
    inv_date: invoiceDateDraft.trim() || null,
    payment_terms: paymentTermsDraft.trim() || null,
    issuing_entity: selectedIssuingEntity ? { ...selectedIssuingEntity, key: selectedIssuingEntity.entity_key, fulfilment_mode: selectedIssuingEntity.route || selectedIssuingEntity.fulfilment_mode || 'INTERNAL', status: 'RESOLVED' } : data?.issuing_entity,
    fulfilment_route: selectedIssuingEntity?.route || data?.fulfilment_route || null,
    currency: noConversion ? 'MYR' : data?.currency,
    no_conversion: noConversion,
    forex: noConversion ? null : forex,
    lines,
  });

  const updateLine = (index: number, patch: Partial<AgentRunLine>) => {
    setLines((previous) => previous.map((line, current) => {
      if (current !== index) return line;
      return editOrderLine(line, patch);
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
      ? { ...line,
          ...(line.line_mapping_mode === 'PART_NO_DESCRIPTION' && patch.en_description !== undefined
            ? { source_description: patch.en_description } : {}),
          ...(patch.sku_code !== undefined ? { sql_item_mode: String(patch.sku_code || '').trim() ? "stock" as const : "free_text" as const } : {}),
          match: { matched: true, confidence: 1, ...(line.match || {}), ...patch, ...(patch.sku_code !== undefined ? { match_method: "reviewer" } : {}) } }
      : line)));
  };

  const updateForex = (patch: Partial<AgentRunForex>) => {
    setNoConversion(false);
    const sourceCurrency = String(data?.currency || 'RMB').toUpperCase();
    const sourceTotal = lines.reduce((sum, line) => sum + Number(line.amount_foreign || 0), 0);
    setForexDraft((previous) => ({
      currency: sourceCurrency,
      amount: Math.round(sourceTotal * 100) / 100,
      operator: ['RMB', 'CNY', 'YUAN'].includes(sourceCurrency) ? '/' : '*',
      flat_fee: 0,
      ...(previous || {}),
      ...patch,
    }));
  };

  const stockChoices: SqlAccountStockItemProposal[] = lines.flatMap((line, index) => {
    const proposal = itemProposals.find(item => item.source_index === index);
    if (line.sql_item_mode === "free_text" || line.match?.sku_code || (!line.use_source_part_no_as_item_code && !proposal)) return [];
    return [{ source_index: index, code: String(proposal?.code || line.source_part_no || line.model || '').replace(/^'/, ''),
      description: String(proposal?.description || line.more_description || line.source_description || line.name || ''),
      uom: line.omit_document_uom ? '' : line.unit || '' }];
  });

  const act = async (fn: () => Promise<AgentRun>, message = 'Saving changes…') => {
    setBusy(true);
    setBusyMessage(message);
    setError(null);
    try {
      hydrate(await fn());
    } catch (e) {
      // A failed SQL validation/post stores the authoritative recovery state.
      // Reload it so an old ready-to-post badge cannot remain after an error.
      if (run) {
        try { hydrate(await getRun(runId)); } catch { /* Keep the original error if the API is unreachable. */ }
      }
      setError((e as Error)?.message || 'Action failed');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  };

  const approveInternalAccounting = async () => {
    setBusy(true);
    setBusyMessage('Creating DO and invoice in the accounting system...');
    setError(null);
    try {
      await startOrderBatch(runId, 'APPROVE', true, buildCorrected());
      hydrate(await getRun(runId));
    } catch (cause) {
      const message = (cause as Error)?.message || 'Action failed';
      const connectionClosed = /failed to fetch|networkerror|load failed|network request failed/i.test(message);
      if (!connectionClosed) {
        setError(message);
      } else {
        let latest: AgentRun | null = null;
        // The POST response can be lost after SQL commits. Poll the durable run
        // state before telling the reviewer to click again.
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          try {
            latest = await getRun(runId);
            hydrate(latest);
            if (latest.status !== 'DRAFT_GENERATED' || latest.output_refs?.sql_account) break;
          } catch {
            // Keep polling while the tunnel or backend recovers.
          }
        }
        if (latest?.status === 'COMPLETED') {
          setError(null);
        } else if (latest?.status === 'DELIVERY_PENDING') {
          setError('The DO and invoice were created. Only customer PDF delivery is pending; use Prepare PDFs & send.');
        } else if (latest?.approved_at) {
          setError('Approval was recorded, but the connection closed before Smartdok received the SQL result. Use Resume SQL result & delivery; the retry is idempotent and will not create a duplicate.');
        } else {
          setError('The connection closed before approval was recorded. No confirmed Smartdok result is available; it is safe to click Approve & create in accounting again.');
        }
      }
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
  const approvalRecorded = Boolean(run?.approved_at);
  const canReview = (status === 'PENDING_REVIEW' || status === 'DRAFT_GENERATED') && !sqlDocumentsCreated;
  const customerValidation = data?.sql_customer_validation;
  const customerIdentityChanged = customerDraft.trim() !== String(data?.customer || '').trim()
    || customerCodeDraft.trim() !== String(data?.customer_code || '').trim()
    || issuingEntityKey !== String(data?.issuing_entity?.entity_key || data?.issuing_entity?.key || '');
  const customerValidationCurrent = Boolean(customerValidation) && !customerIdentityChanged;
  const transactionScope = run?.output_refs?.source_transaction_scope as { kind?: string; evidence?: string } | undefined;
  const canEditDocumentNumbers = canReview && !sqlDocumentsCreated && !sqlAutoInvoiceNumber;
  const hasSqlCustomerProposal = !isOutsourced
    && !customerIdentityChanged
    && status === 'DRAFT_GENERATED'
    && sqlAccountDelivery?.status === 'needs_customer_approval'
    && Boolean(customerProposal);
  const needsSqlCustomer = requiresOrderCustomerSelection({ outsourced: isOutsourced,
    identityChanged: customerIdentityChanged, status, delivery: sqlAccountDelivery, hasProposal: hasSqlCustomerProposal });
  const isOrderWorkflow = run?.review_schema?.template_key === 'order_to_invoice'
    || run?.record_type === 'purchase_order'
    || Boolean(data?.forex && data?.lines);
  const canReanalyze = Boolean(run)
    && ['FAILED', 'PENDING_REVIEW', 'DRAFT_GENERATED'].includes(status || '')
    && !sqlDocumentsCreated
    && !outsourcedEmail
    && !outsourcedWhatsApp;

  const reanalyzeWithAi = () => {
    void act(async () => {
      let updated = await reanalyzeRun(runId);
      for (let attempt = 0; attempt < 90 && ['RECEIVED', 'EXTRACTING'].includes(updated.status); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        updated = await getRun(runId);
      }
      return updated;
    }, 'Re-analyzing the retained source with AI...');
  };

  const downloadSupportingSource = async (sourceRunId: number, filename?: string | null) => {
    setBusy(true);
    setBusyMessage(`Opening ${filename || 'supporting document'}...`);
    setError(null);
    try {
      const blob = await getRunSource(sourceRunId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError((cause as Error)?.message || 'Could not open the supporting document');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  };

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
    amount_myr_total: hasEffectiveMyrAmounts
      ? orderLines.reduce((sum, line) => sum + Number(noConversion ? line.amount_foreign : line.amount_myr || 0), 0)
      : null,
    grand_total_myr: hasEffectiveMyrAmounts
      ? orderLines.reduce((sum, line) => sum + Number(noConversion ? line.amount_foreign : line.amount_myr || 0), 0)
      : null,
  } : totals;

  if (run && !isOrderWorkflow) {
    return (
      <GenericWorkflowReview
        run={run}
        draft={genericDraft}
        sqlJobNotice={sqlJobNotice}
        sqlCheckRunning={sqlCheckRunning}
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
                <div><span className="text-[var(--muted-foreground)]">SQL customer match: </span>{customerCodeDraft ? <b>{customerCodeDraft}</b> : <span className="font-medium text-amber-700">Name detected; live SQL customer code not matched yet</span>}</div>
                <div><span className="text-[var(--muted-foreground)]">PO / source document: </span>{data?.code || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Invoice date: </span>{data?.inv_date || '—'}</div>
                {data?.main_description ? <div><span className="text-[var(--muted-foreground)]">Description: </span><b>{String(data.main_description)}</b></div> : null}
                {data?.payment_terms ? <div><span className="text-[var(--muted-foreground)]">Terms: </span><b>{String(data.payment_terms)}</b></div> : null}
                <div className="flex items-start gap-2"><span className="pt-1 text-[var(--muted-foreground)]">Status: </span><AutomationStatusBadge status={run.display_status || status} destination={approvalDestination} showMeaning /></div>
              </div>
              {run.source_caption && (
                <div className="max-w-xl">
                  <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">WhatsApp message / conversion instruction</p>
                  <pre className="text-xs bg-[var(--muted)] rounded-md p-3 whitespace-pre-wrap">{run.source_caption}</pre>
                </div>
              )}
            </div>

            {isOrderWorkflow && <OrderSSTConfirmation run={run} onSaved={setRun} disabled={busy || sqlDocumentsCreated || !['PENDING_REVIEW','DRAFT_GENERATED'].includes(status || '') || customerDraft !== (data?.customer || '') || customerCodeDraft !== (data?.customer_code || '') || (issuingEntityKey !== String((data?.issuing_entity as BusinessEntityProfile | undefined)?.entity_key || (data?.issuing_entity as Record<string,unknown> | undefined)?.key || ''))} />}
            {supportingSourceFiles.length > 0 && (
              <div className="mt-4 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <p className="font-semibold">AI-linked supporting context ({supportingSourceFiles.length})</p>
                </div>
                <p className="mt-1 text-xs opacity-80">These files were sent in the same burst and classified as company/master-data context. They do not create a separate accounting transaction.</p>
                <div className="mt-3 space-y-2">
                  {supportingSourceFiles.map((item) => (
                    <div key={`${item.source_run_id}-${item.filename || 'support'}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-200 bg-white/70 p-3 dark:border-sky-900 dark:bg-slate-950/40">
                      <div>
                        <p className="font-medium">{item.filename || `Supporting Review #${item.source_run_id}`}</p>
                        {item.reason && <p className="mt-1 text-xs opacity-75">{item.reason}{item.confidence != null ? ` · ${Math.round(item.confidence * 100)}% confidence` : ''}</p>}
                      </div>
                      <button type="button" disabled={busy} onClick={() => void downloadSupportingSource(item.source_run_id, item.filename)} className="inline-flex items-center gap-2 rounded-md border border-sky-400 px-3 py-1.5 text-xs font-semibold hover:bg-sky-100 disabled:opacity-50 dark:hover:bg-sky-900/40"><Download className="h-4 w-4" /> Open file</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(deliveryOrderNumber || invoiceNumber || canEditDocumentNumbers) && (
              <div className={`mt-4 rounded-lg border p-4 ${sqlDocumentsCreated ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100'}`}>
                <div className="flex items-center gap-2">
                  {sqlDocumentsCreated ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                  <p className="font-semibold">SQL Accounting document numbers</p>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold dark:bg-slate-950/40">
                    {sqlDocumentsCreated ? 'Created' : accountingRequest?.reservation_only ? 'Number recorded - awaiting details' : 'Recorded in Review'}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {!invoiceOnly && <div className="rounded-md bg-white/70 p-3 dark:bg-slate-950/40">
                    <p className="text-xs opacity-70">Delivery Order</p>
                    {canEditDocumentNumbers ? <input value={deliveryOrderNumberDraft} onChange={(event) => setDeliveryOrderNumberDraft(event.target.value)} aria-label="Delivery Order number" className="mt-1 w-full rounded border border-cyan-300 bg-white px-2 py-1 font-mono text-lg font-bold text-slate-950" /> : <p className="mt-1 font-mono text-lg font-bold">{deliveryOrderNumber || 'Not allocated'}</p>}
                  </div>}
                  <div className="rounded-md bg-white/70 p-3 dark:bg-slate-950/40">
                    <p className="text-xs opacity-70">Sales Invoice</p>
                    {canEditDocumentNumbers ? <input value={invoiceNumberDraft} onChange={(event) => setInvoiceNumberDraft(event.target.value)} aria-label="Sales Invoice number" className="mt-1 w-full rounded border border-cyan-300 bg-white px-2 py-1 font-mono text-lg font-bold text-slate-950" /> : <p className="mt-1 font-mono text-lg font-bold">{invoiceNumber || (sqlAutoInvoiceNumber ? 'Assigned by SQL on approval' : 'Not allocated')}</p>}
                  </div>
                </div>
                {canEditDocumentNumbers && <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs opacity-75">You may correct the document numbers before approval. The change is recorded in the run audit trail.</p><button type="button" disabled={busy || (!invoiceOnly && !deliveryOrderNumberDraft.trim()) || !invoiceNumberDraft.trim()} onClick={() => void act(() => updateRunDocumentNumbers(runId, invoiceOnly ? "" : deliveryOrderNumberDraft.trim(), invoiceNumberDraft.trim(), undefined, !accountingRequest), 'Saving SQL document numbers…')} className="rounded-md bg-cyan-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save numbers</button></div>}
                {canEditDocumentNumbers && !invoiceOnly && <ReservedDoReview runId={runId} documentNo={deliveryOrderNumberDraft.trim()} invoiceNo={invoiceNumberDraft.trim()} customerCode={String(data?.customer_code || '')} disabled={busy} onConfirm={(token) => act(() => updateRunDocumentNumbers(runId, deliveryOrderNumberDraft.trim(), invoiceNumberDraft.trim(), token, !accountingRequest), 'Recording confirmation...')} />}
                {canEditDocumentNumbers && <p className="mt-2 text-xs">Numbers can be recorded before descriptions arrive. This does not create or reserve a document in SQL. When details arrive, add them to this Review and prepare it for approval.</p>}

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
            {generatedDocuments.length > 0 && <div className="mt-4 rounded-lg border border-slate-300 p-3"><p className="text-sm font-semibold">Generated documents</p><div className="mt-2 flex flex-wrap gap-2">{generatedDocuments.map((file) => <button key={file.file_key} type="button" disabled={busy} onClick={() => void downloadExternalDocument(file)} className="rounded border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">{file.filename}</button>)}</div></div>}
            {salesTax?.customer_group && <div className={`mt-3 rounded-md border p-3 text-sm ${salesTax.applied ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}><b>SQL customer group {salesTax.customer_group}:</b> {salesTax.applied ? `${salesTax.rate || 0}% SST applied to the sales lines.` : 'No configured SST rule applied.'}</div>}
            {conversion?.status === 'PENDING_RATE' && (
              <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div><p className="font-semibold">MYR conversion pending</p><p className="mt-1">The extracted {conversion.source_currency || originalCurrency} values are preserved. Add the applicable exchange rate before generating or posting documents; Smartdok will not treat the missing MYR value as zero.</p></div>
              </div>
            )}
            {aiExtractionNeedsAttention && (
              <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
                <div className="flex min-w-0 flex-1 gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{aiExtractionStatus === 'RECOVERED' ? 'Primary AI extraction needs attention' : 'AI extraction did not complete'}</p>
                    <p className="mt-1">{String(aiExtraction?.message || run.error_message || 'The AI provider did not return a reliable result.')}</p>
                    <p className="mt-1 text-xs opacity-75">The original message or document is retained. Re-analysis updates this same Review item and does not create a duplicate.</p>
                  </div>
                </div>
                {canReanalyze && <button type="button" disabled={busy} onClick={reanalyzeWithAi} className="inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy && busyMessage?.startsWith('Re-analyzing') ? 'animate-spin' : ''}`} /> Re-analyze with AI</button>}
              </div>
            )}
            {run.error_message && !aiExtractionNeedsAttention && !(customerIdentityChanged && /customer/i.test(run.error_message)) && <p className="mt-3 whitespace-pre-wrap text-sm text-red-600">{explainSqlAccountError(run.error_message)}</p>}
            {Boolean(run.output_refs?.manual_order_closure) && (
              <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                {manualClosure?.reason_code === 'DUPLICATE_SOURCE' ? <>
                  <p className="font-semibold">Duplicate source closed</p>
                  <p>This workbook was submitted again. The corresponding DO and Invoice already exist in <a className="underline" href={`/agents/runs/${manualClosure.canonical_run_id}`}>Review #{manualClosure.canonical_run_id}</a>. This old entry cannot be posted again.</p>
                </> : <>
                <p className="font-semibold">已人工结案 / Manually handled</p>
                <p>客户已确认人工处理，此旧请求已停用，不可重新提交。原金额及明细保留；此状态不代表原请求曾自动入账成功。</p>
                </>}
              </div>
            )}
            {agentExecution && <div className="mt-4 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-slate-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-50"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">Agent execution plan</p><p className="mt-1 text-xs leading-5 text-slate-700 dark:text-cyan-100">{agentExecution.plan?.summary || agentExecution.detail || 'The bounded runtime is preparing a safe tool plan.'}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">{(agentExecution.status || 'planning').replaceAll('_', ' ').toLowerCase()}</span></div>{agentExecution.plan?.steps && agentExecution.plan.steps.length > 0 && <div className="mt-3 space-y-2">{[...agentExecution.plan.steps].sort((a, b) => a.sequence - b.sequence).map((step) => { const result = agentExecution.tool_results?.find((item) => item.tool === step.tool); return <div key={`${step.sequence}-${step.tool}`} className="flex gap-3 rounded-lg border border-cyan-200 bg-white p-3 text-xs dark:border-cyan-900 dark:bg-slate-950"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 font-semibold text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100">{step.sequence}</span><span className="min-w-0 flex-1"><strong className="block text-slate-950 dark:text-white">{step.tool.replaceAll('_', ' ').toLowerCase()}</strong><span className="mt-1 block text-slate-700 dark:text-slate-300">{result?.detail || step.purpose}</span></span><span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">{result ? result.status.replaceAll('_', ' ').toLowerCase() : step.requires_approval ? 'awaiting approval' : 'planned'}</span></div>; })}</div>}{agentExecution.plan?.warnings?.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-900 dark:text-amber-200">Warning: {warning}</p>)}</div>}
            {status === 'DRAFT_GENERATED' && !sqlAccountDelivery && <div className="mt-3 rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100"><b>Approval destination:</b> {isOutsourced ? outsourcedChannel === 'WHATSAPP' ? 'approving sends the request to the external provider WhatsApp group configured for this issuing company. A source attachment is included when available; otherwise Smartdok sends the extracted order details as a message.' : 'approving emails the external fulfilment provider configured for this issuing company, tracks the email thread, and collects the returned DO and invoice.' : 'approving creates the Delivery Order and Sales Invoice through the resolved company accounting connection. Smartdok then prepares customer PDFs and returns them to the source channel.'}</div>}
            {outsourcedWhatsApp && status === 'WAITING_EXTERNAL_DOCUMENTS' && (
              <div className="mt-3 rounded-lg border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
                <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><p className="font-semibold">Waiting for the external provider</p><p className="mt-1 break-words">WhatsApp group: <b>{outsourcedWhatsApp.group_name || 'Configured provider group'}</b></p><p className="mt-1 text-xs opacity-80">{outsourcedWhatsApp.test_mode ? 'Test delivery only; the production group was not contacted.' : 'Request sent to the provider group.'}{outsourcedWhatsApp.source_attached === false ? ' No source attachment was available, so the extracted order details were sent as a message.' : ''}</p></div></div>
              </div>
            )}
            {status === 'DRAFT_GENERATED' && supplierPreview?.attachment_file_key && (
              <div className="mt-3 rounded-md border border-cyan-300 p-3 text-sm">
                <p>The supplier will receive the converted MYR Excel with all reviewed order lines.</p>
                <button type="button" disabled={busy} className="mt-2 underline" onClick={() => downloadExternalDocument({
                  file_key: supplierPreview.attachment_file_key!, filename: supplierPreview.attachment_filename || 'Order-MYR.xlsx',
                })}>Download MYR Excel for checking</button>
              </div>
            )}
            {outsourcedEmail && !outsourcedWhatsApp && outsourcedChannel !== 'WHATSAPP' && ['WAITING_EXTERNAL_DOCUMENTS', 'EXTERNAL_DOCUMENTS_RECEIVED', 'AI_VERIFYING', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED'].includes(status || '') && (
              <div className={`mt-3 rounded-lg border p-4 text-sm ${status === 'VERIFICATION_PASSED' ? 'border-lime-300 bg-lime-50 text-lime-950 dark:border-lime-800 dark:bg-lime-950/30 dark:text-lime-100' : status === 'VERIFICATION_FAILED' ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100' : status === 'AI_VERIFYING' ? 'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100' : status === 'EXTERNAL_DOCUMENTS_RECEIVED' ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100'}`}>
                <div className="flex items-start gap-3">
                  {status === 'VERIFICATION_PASSED' ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /> : status === 'VERIFICATION_FAILED' || status === 'EXTERNAL_DOCUMENTS_RECEIVED' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : status === 'AI_VERIFYING' ? <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" /> : <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold">{status === 'VERIFICATION_PASSED' ? 'AI verification passed — pending approval to send customer' : status === 'VERIFICATION_FAILED' ? 'Verification failed — supplier document discrepancies found' : status === 'AI_VERIFYING' ? 'AI is verifying the returned DO/Invoice against the PO' : status === 'EXTERNAL_DOCUMENTS_RECEIVED' ? 'Supplier replied, but the package is incomplete or not yet verified' : 'Waiting for the external provider'}</p>
                    <p className="mt-1 break-words">Email: <b>{outsourcedEmail.subject || 'Document request'}</b></p>
                    <p className="mt-1 break-words text-xs opacity-80">To: {(outsourcedEmail.to || []).join(', ') || 'Not recorded'}{outsourcedEmail.cc?.length ? ` · CC: ${outsourcedEmail.cc.join(', ')}` : ''}{outsourcedEmail.sent_at ? ` · Sent ${formatDateTime(outsourcedEmail.sent_at)}` : ''}</p>
                    {status === 'EXTERNAL_DOCUMENTS_RECEIVED' && !externalPackageComplete && <p className="mt-2 font-medium">Still required: {missingExternalAttachmentLabels.join(', ')}. Unclassified files cannot complete this review.</p>}
                    {status === 'VERIFICATION_FAILED' && <p className="mt-2 font-medium">{failedVerificationChecks.length} check(s) failed. Review the discrepancies, then re-run verification or accept them manually.</p>}
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
            {status === 'VERIFICATION_FAILED' && !!run?.output_refs?.supplier_verification_override && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">Verification discrepancies were accepted manually. The failed checks remain recorded. You may now approve customer delivery.</p>}
            {supplierVerification && (
              <div className={`mt-3 rounded-lg border p-4 text-sm ${supplierVerification.status === 'PASSED' ? 'border-lime-300 bg-lime-50 text-lime-950 dark:border-lime-800 dark:bg-lime-950/30 dark:text-lime-100' : 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">AI supplier document check: {supplierVerification.status === 'PASSED' ? 'Verification Passed' : 'Verification Failed'}</p>
                  <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold dark:bg-slate-950/40">{supplierVerification.summary?.passed || 0} passed · {supplierVerification.summary?.failed || 0} failed</span>
                </div>
                <div className="mt-3 space-y-3">
                  {(supplierVerification.original_source_comparisons || []).map((comparison,index)=><div key={`source-${index}`} className="rounded border border-current/20 p-3">
                    <p className="font-semibold">Original PO + instructions / 原 PO 及指示 · {comparison.filename} · {comparison.status}</p>
                    {comparison.reason&&<p>{comparison.reason}</p>}
                    {comparison.checks?.map(check=><details key={check.category} className="mt-2"><summary>{check.status} · {check.category} · {check.reason}</summary><p className="mt-1 whitespace-pre-wrap">PO: {check.original_evidence}</p><p className="whitespace-pre-wrap">Returned / 回传: {check.returned_evidence}</p></details>)}
                  </div>)}
                  {(supplierVerification.documents || []).map((document) => <div key={`${document.kind}-${document.filename}`} className="rounded-md border border-current/20 bg-white/60 p-3 dark:bg-slate-950/30"><p className="font-medium">{document.filename} · {humanLabel(document.kind || 'document')}{document.document_number ? ` · ${document.document_number}` : ''}</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{(document.checks || []).map((check, index) => <p key={`${check.code}-${check.line || 0}-${index}`} className={`text-xs ${check.status === 'FAILED' ? 'font-semibold text-red-800 dark:text-red-200' : 'text-emerald-800 dark:text-emerald-200'}`}>{check.status === 'PASSED' ? '✓' : '✕'} {check.line ? `Line ${check.line}: ` : ''}{check.label}{check.status === 'FAILED' ? ` — expected ${String(check.expected ?? 'value')}, got ${String(check.actual ?? 'blank')}` : ''}</p>)}</div></div>)}
                </div>
              </div>
            )}
            {sqlAccountDelivery && <div className={`mt-3 rounded-md p-3 text-sm ${sqlAccountDelivery.status === 'created' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}>
              {sqlAccountDelivery.status === 'created' ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}
              <b>SQL Account:</b> {sqlAccountDelivery.status === 'created'
                ? `created Delivery Order ${sqlAccountDelivery.delivery_order?.document_no || '—'} and Sales Invoice ${sqlAccountDelivery.invoice?.document_no || '—'}.`
                : `not posted. ${explainSqlAccountError(sqlAccountDelivery.detail || sqlAccountDelivery.note) || 'Check the SQL Account connection and master-data matches.'}`}
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
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{isOutsourced ? 'Confirm the buyer and source PO date for the supplier. Outsourced customers do not need a customer record in our SQL Account.' : 'Confirm the buyer details before generating. An SQL Account customer code is optional until posting. A PO Ref is sent to the SQL Account Ref field.'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Issuing company"><select value={issuingEntityKey} onChange={(event) => setIssuingEntityKey(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-slate-950 dark:bg-slate-950 dark:text-white"><option value="">Select from Knowledge Base</option>{entityProfiles.map((profile) => <option key={profile.entity_key} value={profile.entity_key}>{profile.legal_name} · {(profile.route || 'INTERNAL').toLowerCase()}{profile.role && profile.role !== 'ISSUER' ? ` · ${profile.role.toLowerCase()}` : ''}</option>)}</select></Field>
                <Field label="Customer / company name"><input value={customerDraft} onChange={(event) => setCustomerDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                {!isOutsourced && <Field label="SQL Account customer code"><input maxLength={10} value={customerCodeDraft} onChange={(event) => setCustomerCodeDraft(event.target.value.toUpperCase())} placeholder="Optional" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>}
                <Field label="Reference code"><input value={documentCodeDraft} onChange={(event) => setDocumentCodeDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="PO Ref (SQL Account Ref)"><input value={sourceReferenceDraft} onChange={(event) => setSourceReferenceDraft(event.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Invoice date"><input type="date" value={invoiceDateDraft} onChange={(event) => setInvoiceDateDraft(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
                <Field label="Payment terms"><input value={paymentTermsDraft} onChange={(event) => setPaymentTermsDraft(event.target.value)} placeholder="e.g. 60 days" className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)]" /></Field>
              </div>
              {!isOutsourced && <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-[var(--border)] p-3 text-sm" aria-live="polite">
                <span className={customerValidationCurrent && customerValidation?.status === 'MATCHED' ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--muted-foreground)]'}>
                  {customerValidationCurrent ? customerValidation?.message : 'Customer details need a fresh check in the selected accounting company.'}
                </span>
                <button type="button" disabled={busy} onClick={() => act(() => reviewRun(runId, buildCorrected()), 'Checking the customer in SQL Account...')} className="rounded border border-[var(--border)] px-3 py-1.5 font-medium disabled:opacity-50">Save & check customer</button>
              </div>}
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
            {transactionScope?.kind === 'logical_rows' && <p className="border-b border-[var(--border)] bg-cyan-50 p-3 text-sm text-cyan-950 dark:bg-cyan-950/30 dark:text-cyan-100">
              Shared original PDF: this review contains set {String(run.output_refs?.source_transaction_index)} of {String(run.output_refs?.source_transaction_count)}. Other sets appear in their own reviews. {transactionScope.evidence}
            </p>}
            {sourceUrl && sourceIsPdf && <iframe title={`Preview of ${sourceName}`} src={sourceUrl} className="h-[620px] w-full bg-white" />}
            {sourceUrl && sourceIsImage && <div className="bg-[var(--muted)] p-4"><img src={sourceUrl} alt={`Preview of ${sourceName}`} className="mx-auto max-h-[620px] rounded object-contain" /></div>}
            {sourceUrl && sourceIsSpreadsheet && <div className="flex min-h-40 items-center justify-center gap-3 p-8 text-sm text-[var(--muted-foreground)]"><FileSpreadsheet className="h-8 w-8 text-green-700" /> Excel is retained in its original form. Download it to inspect the source cells.</div>}
            {sourceUrl && !sourceIsPdf && !sourceIsImage && !sourceIsSpreadsheet && <div className="flex min-h-40 items-center justify-center gap-3 p-8 text-sm text-[var(--muted-foreground)]"><ImageIcon className="h-8 w-8" /> This file type is available to download.</div>}
            {!run.source_file_s3_key && <p className="p-5 text-sm text-[var(--muted-foreground)]">No source attachment is stored for this Review. For a message-only order, use the original message above; upload a file only if one was supplied.</p>}
            {sourceError && <p className="p-5 text-sm text-amber-700">{sourceError}</p>}
          </section>

          {canReview && (
            <section className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Conversion details</h2>
                  <p className="text-sm text-[var(--muted-foreground)]">Review the rate extracted from the WhatsApp message. Saving recalculates every MYR line value.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setNoConversion(true); setForexDraft(null); }} className={`rounded-md border px-3 py-2 text-sm font-medium ${noConversion ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-[var(--border)] hover:bg-[var(--hover-bg)]'}`}>
                    {noConversion ? '✓ Prices are already MYR' : 'Prices are already MYR'}
                  </button>
                  {(!forex || noConversion) && <button type="button" onClick={() => updateForex({})} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]">Add MYR total / rate</button>}
                </div>
              </div>
              {data?.conversion?.status === 'TOTAL_MISMATCH' && (
                <div role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {data.conversion.reason}
                </div>
              )}
              {noConversion ? (
                <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                  Source prices will be copied directly to MYR. No exchange rate will be applied.
                </div>
              ) : forex ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Field label="Original currency"><input value={forex.currency || ''} onChange={(e) => updateForex({ currency: e.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Formula amount"><input type="number" value={forex.amount ?? ''} onChange={(e) => updateForex({ amount: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Operator"><select value={forex.operator || '/'} onChange={(e) => updateForex({ operator: e.target.value })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]"><option value="/">÷</option><option value="*">×</option></select></Field>
                  <Field label="Conversion rate"><input type="number" step="any" value={forex.rate ?? ''} onChange={(e) => updateForex({ rate: numeric(e.target.value), calculation_mode: 'rate', force_expected_total: false, document_total_override: null })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Flat fee (MYR)"><input type="number" step="any" value={forex.flat_fee ?? ''} onChange={(e) => updateForex({ flat_fee: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <Field label="Target invoice total (MYR)"><input type="number" step="0.01" value={forex.expected_total ?? ''} onChange={(e) => updateForex({ expected_total: numeric(e.target.value), rate: null, calculation_mode: 'target', force_expected_total: true, document_total_override: numeric(e.target.value) })} className="mt-1 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm text-[var(--foreground)]" /></Field>
                  <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
                    <span>{forex.calculation_mode === 'target' ? 'Calculating from target MYR total.' : 'Calculating from exchange rate.'} Enter the final MYR total to derive the rate, or edit the rate to calculate by rate. Source amounts must reconcile first.</span>
                    <button type="button" disabled={busy} onClick={() => act(() => reviewRun(runId, buildCorrected()), 'Calculating MYR amounts...')} className="rounded-md bg-cyan-700 px-3 py-2 font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">Apply & calculate</button>
                  </div>
                </div>
              ) : <p className="mt-3 text-sm text-amber-700">No conversion formula was detected. Add the rate from the WhatsApp message before you generate a foreign-currency invoice.</p>}
            </section>
          )}

          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
            <div className="p-4 border-b border-[var(--border)] font-semibold">Extracted order lines ({orderLines.length}){headingCount > 0 && <span className="font-normal text-[var(--muted-foreground)]"> + {headingCount} section heading{headingCount === 1 ? '' : 's'}</span>}{contextCount > 0 && <span className="font-normal text-[var(--muted-foreground)]"> + {contextCount} included context row{contextCount === 1 ? '' : 's'}</span>}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[var(--muted-foreground)]">
                  <th className="px-3 py-2">Product (source)</th><th className="px-3 py-2">More description</th><th className="px-3 py-2">Item code / Internal SKU</th><th className="px-3 py-2">English description</th>
                  <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">UOM</th><th className="px-3 py-2">Colour</th><th className="px-3 py-2 text-right">Unit price ({originalCurrency})</th><th className="px-3 py-2 text-right">Amount ({originalCurrency})</th>
                  <th className="px-3 py-2 text-right">Unit (MYR)</th><th className="px-3 py-2 text-right">Amount (MYR)</th><th className="w-14 px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>{lines.map((line, index) => {
                  const descriptiveOnly = ['header', 'included_component'].includes(line.category || '');
                  return (
                  <tr key={index} className={`border-t border-[var(--border)] align-top ${line.category === 'header' ? 'bg-cyan-500/10 font-medium' : line.category === 'included_component' ? 'bg-[var(--muted)]/45 text-[var(--muted-foreground)]' : ''}`}>
                    <td className="px-3 py-2"><div className={line.category === 'included_component' ? 'pl-4' : ''}>{line.category === 'included_component' ? '↳ ' : ''}{line.name}</div><div className="text-xs text-[var(--muted-foreground)]">{line.model}{line.category && <> · {humanLabel(line.category)}</>}</div></td>
                    <td className="px-3 py-2"><textarea disabled={!canReview} value={line.more_description || ''} onChange={(e) => updateLine(index, { more_description: e.target.value || null })} rows={4} placeholder="Continuation details" aria-label={`More description for ${line.name || `row ${index + 1}`}`} className="w-72 rounded border border-[var(--border)] bg-transparent px-2 py-1 disabled:opacity-50" /></td>
                    <td className="px-3 py-2"><input disabled={!canReview || descriptiveOnly} value={(line.line_mapping_mode === 'PART_NO_DESCRIPTION' ? line.source_part_no : line.match?.sku_code) || ''} aria-label={`Item code for ${line.name || `row ${index + 1}`}`} onChange={(e) => line.line_mapping_mode === 'PART_NO_DESCRIPTION' ? updateLine(index, { source_part_no: e.target.value, model: e.target.value, match: { ...line.match, matched: false, confidence: 0, sku_code: null }, sql_account_uom: undefined }) : updateMatch(index, { sku_code: e.target.value })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 disabled:opacity-50" />{canReview && !descriptiveOnly && <button type="button" className="mt-1 block text-xs text-cyan-700" onClick={() => updateLine(index, { sql_item_mode: 'free_text', match: { matched: false, confidence: 0, sku_code: null }, sql_item_resolution: undefined })}>{line.sql_item_mode === 'free_text' ? 'Free-text line selected' : 'Use without item code'}</button>}</td>
                    <td className="px-3 py-2">
                      <input disabled={!canReview} value={line.match?.en_description || ''} onChange={(e) => updateMatch(index, { en_description: e.target.value })} className="w-56 rounded border border-[var(--border)] bg-transparent px-2 py-1" />
                      <label className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-foreground)]" title="After final approval, reuse this English for the same company, customer and source product. Uncheck for a one-off description.">
                        <input type="checkbox" disabled={!canReview} checked={line.remember_description_mapping !== false} onChange={(e) => updateLine(index, { remember_description_mapping: e.target.checked })} />
                        Reuse English after approval
                      </label>
                      {line.approved_description_mapping?.state === 'CONFLICT' && <p className="mt-1 text-xs text-amber-700">Previous approvals differ. Check this description before approving.</p>}
                      {line.match?.translation_source === 'human_approved_mapping' && <p className="mt-1 text-xs text-[var(--muted-foreground)]">Previously approved English</p>}
                    </td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" value={line.qty ?? ''} onChange={(e) => updateLine(index, { qty: numeric(e.target.value) })} className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2"><input disabled={!canReview || descriptiveOnly} value={line.omit_document_uom ? '' : line.unit || ''} onChange={(e) => updateLine(index, { unit: e.target.value.toUpperCase(), sql_account_uom: null, omit_document_uom: !e.target.value.trim() })} placeholder="Blank" aria-label={`UOM for ${line.name || `row ${index + 1}`}`} className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 uppercase disabled:opacity-50" /></td>
                    <td className="px-3 py-2"><input disabled={!canReview || descriptiveOnly} value={line.color || ''} onChange={(e) => updateLine(index, { color: e.target.value.toUpperCase() })} placeholder="Blank" aria-label={`Colour for ${line.name || `row ${index + 1}`}`} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 uppercase disabled:opacity-50" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" step="any" value={line.unit_price_foreign ?? ''} onChange={(e) => updateLine(index, { unit_price_foreign: numeric(e.target.value) })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right"><input disabled={!canReview} type="number" step="any" value={line.amount_foreign ?? ''} onChange={(e) => updateLine(index, { amount_foreign: numeric(e.target.value) })} className="w-28 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right" /></td>
                    <td className="px-3 py-2 text-right">{fmt(noConversion ? line.unit_price_foreign : line.unit_price_myr)}</td><td className="px-3 py-2 text-right">{fmt(noConversion ? line.amount_foreign : line.amount_myr)}</td>
                    <td className="px-3 py-2 text-right">{canReview && <button type="button" onClick={() => removeLine(index)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40" title={`Remove ${line.category === 'header' ? 'section heading' : 'order line'}`} aria-label={`Remove ${line.name || `row ${index + 1}`}`}><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                );})}</tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[var(--border)] text-sm flex flex-wrap gap-6 justify-end"><span>Original total: <b>{originalCurrency} {fmt(displayedTotals.amount_foreign_total)}</b></span><span>Qty total: <b>{fmt(displayedTotals.qty_total)}</b></span>{forex && <span>Flat fee: <b>RM {fmt(displayedTotals.flat_fee)}</b></span>}<span>Grand total: <b>{displayedTotals.grand_total_myr == null ? 'Pending conversion' : `RM ${fmt(displayedTotals.grand_total_myr)}`}</b></span></div>
          </div>

          {hasSqlCustomerProposal && customerProposal && (
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
                <button disabled={busy || customerCodeDraft.trim().length < 2} onClick={() => act(async () => { await reviewRun(runId, buildCorrected()); return approveRun(runId); })} className="inline-flex items-center gap-2 rounded-md border border-violet-500/50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300"><Send className="h-4 w-4" /> Use existing code & approve</button>
                <button disabled={busy || customerCodeDraft.trim().length < 2 || customerDraft.trim().length < 2} onClick={() => act(async () => { await reviewRun(runId, buildCorrected()); return createSqlAccountCustomerAndRepush(runId, { code: customerCodeDraft, company_name: customerDraft, address: '' }); })} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"><Send className="h-4 w-4" /> Create customer & re-push</button>
              </div>
            </section>
          )}
          {canReview && isOrderWorkflow && !isOutsourced && ['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(status) && stockChoices.length > 0 && (
            <SqlItemResolution key={`${runId}:${JSON.stringify(stockChoices)}`} items={stockChoices} busy={busy}
              onCheck={() => act(async () => { await reviewRun(runId, buildCorrected()); return checkSqlAccountItems(runId); }, 'Checking SQL stock matches...')}
              onApply={items => act(async () => {
                const saved = await reviewRun(runId, buildCorrected());
                if (!saved.updated_at) throw new Error('Update the backend before applying stock choices.');
                return applySqlItemBatches(items, saved,
                  (batch, version) => resolveSqlAccountItems(runId, batch, version),
                  (completed, total) => setBusyMessage(`Applying SQL item choices: ${completed}/${total} completed. Keep this page open.`));
              }, 'Applying reviewed SQL item choices...')} />
          )}

          {bundle && bundle.total > 1 && (
            <div className={`mb-4 rounded-md border p-3 text-sm ${bundle.all_ready ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'}`}>
              <p className="font-semibold">
                Set {bundle.index ?? '?'} of {bundle.total} from the same source
              </p>
              <p className="mt-1">
                {bundle.all_ready
                  ? 'Every set in this order has been reviewed.'
                  : `${bundle.pending_count} of ${bundle.total} still need review. ${isOutsourced ? 'Use the combined supplier request below to preview one email for these sets.' : 'Use Prepare all sets below, check the results, then approve the prepared sets together.'}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bundle.members.map((member) => (
                  <Link
                    key={member.id}
                    href={`/review/${member.id}`}
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium ${member.id === runId ? 'border-[var(--foreground)] font-semibold' : 'border-[var(--border)] hover:bg-[var(--muted)]'} ${member.ready ? '' : 'opacity-70'}`}
                  >
                    #{member.id}{member.ready ? '' : ' · needs review'}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {isOrderWorkflow && <OrderBatchActions
            key={`${runId}:${String(run.output_refs?.order_batch_job_id || '')}`} runId={runId} total={bundle?.total || 1} outsourced={isOutsourced}
            unpreparedCount={(bundle?.members || [{status: run.status}]).filter(member => ['PENDING_REVIEW', 'RECEIVED', 'EXTRACTING'].includes(member.status)).length}
            editable={canReview} onRefresh={() => getRun(runId).then((updated) => {
              setRun(updated);
              // A rejected click during a batch is transient. Clear only that
              // local error when the durable job has finished; retain real errors.
              if (!updated.output_refs?.order_batch_active) {
                setError((previous) => previous?.includes('This order is being processed in a batch.') ? null : previous);
              }
            }).catch(() => {})}
            reply={run?.output_refs?.outsource_batch_reply as { anchor_run_id: number; files: { file_key: string; filename?: string }[] } | undefined}
            selectedFiles={run?.output_refs?.outsource_batch_selected_files as string[] | undefined}
          />}
          <div className="flex flex-wrap gap-3">
            {canReanalyze && !aiExtractionNeedsAttention && <button disabled={busy} onClick={reanalyzeWithAi} className="inline-flex items-center gap-2 rounded-md border border-cyan-400 px-4 py-2 text-cyan-800 hover:bg-cyan-50 disabled:opacity-50 dark:text-cyan-200 dark:hover:bg-cyan-950/30"><RefreshCw className={`h-4 w-4 ${busy && busyMessage?.startsWith('Re-analyzing') ? 'animate-spin' : ''}`} /> Re-analyze with AI</button>}
            {status === 'PENDING_REVIEW' && <>
              <button disabled={busy} onClick={() => act(() => reviewRun(runId, buildCorrected()))} className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)]">Save corrections</button>
              <button disabled={busy} title={preparationBlocker || undefined} onClick={prepareForSql} className={`px-4 py-2 text-white rounded-md disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 ${preparationBlocker ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'}`}><FileText className="h-4 w-4" /> {isOutsourced ? 'Prepare external request' : 'Prepare for accounting approval'}</button>
              {preparationBlocker && <p className="basis-full text-sm font-medium text-amber-800"><AlertTriangle className="mr-1.5 inline h-4 w-4" />{preparationBlocker}</p>}
            </>}
            {status === 'DRAFT_GENERATED' && <>
              {!sqlDocumentsCreated && <button disabled={busy || !canGenerateDocuments} onClick={() => act(async () => { await reviewRun(runId, buildCorrected()); return generateRun(runId); })} className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)]">Update prepared data</button>}
              {isOutsourced
                ? <button disabled={busy} onClick={() => act(() => approveRun(runId, buildCorrected()), 'Sending request to the external provider...')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:cursor-wait disabled:opacity-70 flex items-center gap-2">{busy && busyMessage?.startsWith('Sending request') ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy && busyMessage?.startsWith('Sending request') ? `Sending ${outsourcedChannel === 'WHATSAPP' ? 'WhatsApp request' : 'email'}...` : `Approve & ${outsourcedChannel === 'WHATSAPP' ? 'send WhatsApp request' : 'email external provider'}`}</button>
                : approvalRecorded
                  ? <button disabled={busy} onClick={() => act(() => repushRunToSqlAccount(runId), 'Reconciling the approved SQL result and delivery...')} className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70 flex items-center gap-2"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Resume SQL result & delivery</button>
                  : (!sqlAccountDelivery || sqlAccountDelivery.status === 'failed' ? <button disabled={busy} onClick={() => void approveInternalAccounting()} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:cursor-wait disabled:opacity-70 flex items-center gap-2">{busy && busyMessage?.startsWith('Creating DO') ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy && busyMessage?.startsWith('Creating DO') ? 'Creating in accounting...' : 'Approve & create in accounting'}</button> : null)}
            </>}
            {(status === 'PENDING_REVIEW' || status === 'DRAFT_GENERATED') && <button disabled={busy} onClick={() => act(() => rejectRun(runId, 'Rejected by reviewer'))} className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50">Reject</button>}
            {status === 'EXTERNAL_DOCUMENTS_RECEIVED' && (
              <button disabled={busy || externalDocuments.length === 0} title={!externalPackageComplete ? 'AI will inspect the file contents and identify any unclassified DO or Invoice.' : undefined} onClick={() => act(() => verifySupplierDocuments(runId), 'AI is checking the supplier documents against the PO...')} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Run AI verification</button>
            )}
            {status === 'AI_VERIFYING' && <span className="flex items-center gap-2 text-orange-800 dark:text-orange-200"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking supplier, customer, document numbers, lines, prices and totals…</span>}
            {status === 'VERIFICATION_FAILED' && <button disabled={busy} onClick={() => act(() => verifySupplierDocuments(runId), 'Rechecking the supplier documents against the PO...')} className="px-4 py-2 border border-red-400 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 dark:text-red-300 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Re-run AI verification</button>}
            {status === 'VERIFICATION_FAILED' && <button disabled={busy} onClick={() => act(() => skipSupplierVerification(runId), 'Recording manual acceptance...')} className="rounded-md bg-amber-600 px-4 py-2 text-white disabled:opacity-50">Skip failed verification - accept discrepancies</button>}
            {(status === 'VERIFICATION_PASSED' || (status === 'VERIFICATION_FAILED' && !!run?.output_refs?.supplier_verification_override)) && <>
              <div className="basis-full rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-950 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100">
                <b>WhatsApp delivery destination:</b> {customerWhatsAppGroup}{customerWhatsAppJid && customerWhatsAppJid !== customerWhatsAppGroup ? ` (${customerWhatsAppJid})` : ''}
              </div>
              <button disabled={busy || !customerWhatsAppJid} title={!customerWhatsAppJid ? 'The source WhatsApp group is unavailable; configure it before sending.' : undefined} onClick={() => act(() => sendRunToWhatsApp(runId), 'Sending verified supplier documents to the customer...')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><Send className="h-4 w-4" /> Approve & send to customer</button>
            </>}
            {status === 'WAITING_EXTERNAL_DOCUMENTS' && <span className="flex items-center gap-2 text-cyan-800 dark:text-cyan-200"><Clock3 className="h-4 w-4" /> Request sent; {outsourcedWhatsApp ? 'await the external provider response.' : 'Smartdok will collect replies from the same email thread.'}</span>}
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
  sqlJobNotice,
  sqlCheckRunning,
}: {
  run: AgentRun;
  draft: Record<string, unknown>;
  setDraft: (value: Record<string, unknown>) => void;
  busy: boolean;
  loading: boolean;
  error: string | null;
  act: (fn: () => Promise<AgentRun>) => Promise<void>;
  sqlJobNotice?: string;
  sqlCheckRunning?: boolean;
}) {
  const router = useRouter();
  if (run.review_schema?.template_key === 'payment_knock_off') {
    return <PaymentWorkflowReview run={run} draft={draft} setDraft={setDraft} busy={busy} loading={loading} error={error} act={act} sqlJobNotice={sqlJobNotice} sqlCheckRunning={sqlCheckRunning} />;
  }
  const runId = run.id;
  const fields = run.review_schema?.fields || [];
  const editable = run.status === 'PENDING_REVIEW' || run.status === 'DRAFT_GENERATED';
  const approvalDestination = inferApprovalDestination(draft, run.review_schema?.template_key);
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
      <button onClick={() => router.push(router.query.returnTo === 'capture' ? '/capture' : '/review')} className="mb-4 flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
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
                  <StatusPill status={run.display_status || run.status} destination={approvalDestination} showMeaning />
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

type PaymentSlip = { project?: string; destination_name?: string; source_index?: number; payment_date?: string | null; bank_reference?: string | null; payer?: string | null; payer_name?: string | null; payer_account?: string | null; amount?: number | null; currency?: string | null; destination_bank_name?: string | null; destination_account?: string | null; payment_method_code?: string | null; payment_method_match?: { status?: string; reason?: string; method_label?: string; confidence?: number }; receipt_status?: string | null; evidence_status?: string | null; instrument_type?: string | null; image_quality?: string | null; quality_issues?: string[]; confidence?: number | null; evidence_file?: string | null; unapplied_amount?: number | null; payment_direction?: string | null; direction_reason?: string | null };
type PaymentInvoice = { requested_amount_source?: string; project?: string; invoice_number?: string | null; invoice_number_as_printed?: string | null; document_date?: string | null; stated_amount?: number | null; requested_amount?: number | null; document_amount?: number | null; open_balance?: number | null; status?: string | null };
type PaymentInvoiceMatch = {
  invoice_number?: string | null;
  matched_invoice_number?: string | null;
  found?: boolean;
  eligible?: boolean;
};
type PaymentAllocation = { or_index?: number; slip_index?: number; invoice_number?: string | null; amount_to_allocate?: number | null; remaining_invoice_balance?: number | null };
type PaymentMethod = { code?: string; label?: string; bank_account?: string; is_default?: boolean };
type PaymentState = { display_status?: string; funds_status?: string; slip_status?: string; customer_status?: string; invoice_status?: string; knock_off_status?: string };
type PaymentSourceMessage = { payment_status_history?: Array<{ status_code?: string; funds_status?: string; declared_slip_status?: string }>; capture_event_id?: number; received_at?: string | null; sender?: { id?: string; name?: string }; text?: string; status?: string; error_message?: string; filenames?: string[]; quoted?: { message_id?: string; type?: string; preview?: string; sender_name?: string }; ai_analysis?: { customer_name?: string | null; amount?: number | null; currency?: string | null; invoice_numbers?: string[]; bank_references?: string[]; evidence_summary?: string; confidence?: number; reason?: string; workflow_category?: string; intent?: { intent_type?: string; funds_status?: string } }; ai_failure?: { code?: string; message?: string; retryable?: boolean } };
type PaymentSourceContext = { source_type?: string; channel_ref?: string; group_name?: string; senders?: Array<{ id?: string; name?: string }>; capture_event_ids?: number[]; first_received_at?: string | null; last_received_at?: string | null; messages?: PaymentSourceMessage[] };

function PaymentWorkflowReview({ run, draft, setDraft, busy, loading, error, act, sqlJobNotice, sqlCheckRunning = false }: { run: AgentRun; draft: Record<string, unknown>; setDraft: (value: Record<string, unknown>) => void; busy: boolean; loading: boolean; error: string | null; act: (fn: () => Promise<AgentRun>, message?: string) => Promise<void>; sqlJobNotice?:string; sqlCheckRunning?:boolean }) {
  const submitJobId = String(run.output_refs?.payment_submit_job_id || '');
  const submitActive = Boolean(run.output_refs?.payment_submit_active);
  const submitRequest = useRef<{ scope: string; id: string } | null>(null);
  busy = busy || sqlCheckRunning || submitActive;
  const router = useRouter();
  const [varianceModal, setVarianceModal] = useState(false);
  const slips = (Array.isArray(draft.payment_slips) ? draft.payment_slips : []) as PaymentSlip[];
  const excludedSlips = (Array.isArray(draft.excluded_payment_slips) ? draft.excluded_payment_slips : []) as PaymentSlip[];
  const invoices = (Array.isArray(draft.requested_invoices) ? draft.requested_invoices : []) as PaymentInvoice[];
  const openInvoiceCandidates = (Array.isArray(draft.open_invoice_candidates) ? draft.open_invoice_candidates : []) as PaymentInvoice[];
  const invoiceSuggestions = (Array.isArray(draft.invoice_suggestions) ? draft.invoice_suggestions : []) as PaymentInvoice[];
  const detectedCustomerMarkers = (Array.isArray(draft.detected_customer_markers) ? draft.detected_customer_markers : []) as string[];
  const allocations = (Array.isArray(draft.allocations) ? draft.allocations : []) as PaymentAllocation[];
  const methods = (Array.isArray(draft.payment_methods) ? draft.payment_methods : []) as PaymentMethod[];
  const sqlPreview = (draft.sql_preview && typeof draft.sql_preview === 'object' ? draft.sql_preview : {}) as {
    status?: string;
    detail?: string;
    note?: string;
    invoice_matches?: PaymentInvoiceMatch[];
    open_invoice_search?: { status?: string; has_more?: boolean; limit?: number };
  };
  const warnings = (Array.isArray(draft.warnings) ? draft.warnings : []) as string[];
  const source = (draft.source && typeof draft.source === 'object' ? draft.source : {}) as { files?: ExternalDocument[]; message?: string };
  const paymentCompany = (draft.payment_company && typeof draft.payment_company === 'object' ? draft.payment_company : {}) as { company_name?: string; company_key?: string; sql_connection_id?: number; group_name?: string; group_id?: string };
  const nexco = paymentCompany.company_key?.toLowerCase() === 'nexco';
  const supplierPlan = Object.values(slips.reduce<Record<string,{project:string;method:string;date:string;amount:number;slips:number[]}>>((rows,slip,index) => {
    const key = JSON.stringify([slip.project,slip.payment_method_code,slip.payment_date]);
    const row = rows[key] ||= {project:slip.project || 'Needs PIC confirmation',method:slip.payment_method_code || 'Not selected',date:slip.payment_date || 'Date required',amount:0,slips:[]};
    row.amount += Number(slip.amount || 0); row.slips.push(index+1); return rows;
  },{}));
  const aiDecision = (draft.ai_payment_decision || {}) as { status?: string; reason?: string; issues?: string[] };
  const paymentState = (draft.payment_state && typeof draft.payment_state === 'object' ? draft.payment_state : {}) as PaymentState;
  const customerConflict = (draft.customer_identity_conflict && typeof draft.customer_identity_conflict === 'object' ? draft.customer_identity_conflict : null) as { live_invoice_customer?: string; message_or_slip_candidates?: string[] } | null;
  const refs = (run.output_refs || {}) as { invoice_chase?: { status?: string; next_due_at?: string; detail?: string; sent_count?: number }; awaiting_instruction?: boolean; source_files?: ExternalDocument[]; source_context?: PaymentSourceContext; sql_account_payment?: { status?: string; detail?: string; note?: string; receipts?: Array<{ or_no?: string; receipt?: { or_no?: string }; status?: string; allocations?: Array<Record<string, unknown>>; invoice_allocations?: Array<Record<string, unknown>>; detail?: string }> }; sql_official_receipts?: ExternalDocument[]; notify?: { status?: string; delivery_type?: string; detail?: string; note?: string; message?: string; documents?: string[]; reply_to_message_id?: string; source_target?: { message_id?: string; sender_name?: string; text?: string; capture_event_id?: number } } };
  const awaitingInstruction = Boolean(run.awaiting_instruction || refs.awaiting_instruction)
    || (!run.extracted_data && !run.corrected_data && run.events.some((event) => /waiting for (?:the )?processing instruction/i.test(event.message || '')));
  const editable = !busy && ['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(run.status);
  const canApprove = run.status === 'DRAFT_GENERATED';
  const sqlReady = sqlPreview.status === 'ready';
  const postingFailed = ['failed', 'partial'].includes(refs.sql_account_payment?.status || '');
  const moneyText = (value?: number | null) => `RM ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayedSlipTotal = slips.reduce((sum, slip) => sum + Number(slip.amount || 0), 0);
  const displayedInvoiceTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.requested_amount ?? invoice.stated_amount ?? 0), 0);
  const displayedAllocatedTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amount_to_allocate || 0), 0);
  const displayedUnappliedTotal = displayedSlipTotal - displayedAllocatedTotal;
  const nonReceivable = ['NOT_RECEIVABLE', 'PAYABLE'].includes(paymentState.display_status || '') || (excludedSlips.length > 0 && slips.length === 0);
  const missingInvoiceNumbers = invoices.length === 0 && !nonReceivable;
  const paymentMethodFor = (slip: PaymentSlip) => {
    const code = slip.payment_method_code || '';
    return methods.find((item) => item.code === code);
  };
  const updateSlips = (next: PaymentSlip[]) => setDraft({ ...draft, payment_slips: next.map((s,i) =>
    s.payment_method_code !== slips[i]?.payment_method_code ? { ...s, payment_method_match: {status:'MANUAL',reason:'PIC selected this SQL payment method.'} } : s) });
  const updateInvoices = (next: PaymentInvoice[]) => setDraft({ ...draft, requested_invoices: next });
  const editInvoiceNumber = (index: number, value: string) => setDraft({
    ...draft,
    requested_invoices: invoices.map((row, position) => ({ ...row, open_balance: null, requested_amount: 0,
      ...(position === index ? { invoice_number: value, invoice_number_as_printed: row.invoice_number_as_printed || row.invoice_number } : {}),
    })),
    sql_preview: { status: 'stale', detail: 'Invoice number changed. Search SQL again to verify it.' },
    open_invoice_candidates: [], invoice_suggestions: [], allocations: [], allocation_override: [],
    payment_state: { ...paymentState, display_status: 'SQL_CHECK_REQUIRED', invoice_status: 'NOT_VERIFIED', knock_off_status: 'NOT_ALLOCATED' },
  });
  const updateAllocations = (next: PaymentAllocation[]) => setDraft({ ...draft, allocations: next, allocation_override: next });
  const removeSlip = (index: number) => setDraft({
    ...draft,
    payment_slips: slips.filter((_row, position) => position !== index),
    allocations: [],
    allocation_override: [],
  });
  const removeInvoice = (index: number) => setDraft({
    ...draft,
    requested_invoices: invoices.filter((_row, position) => position !== index),
    allocations: [],
    allocation_override: [],
  });
  const invoiceKey = (value?: string | null) => String(value || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const invoiceSqlStatus = (invoice: PaymentInvoice) => {
    if (sqlPreview.status !== 'ready') {
      return { label: 'SQL preview unavailable', tone: 'amber' as const, title: sqlPreview.detail || sqlPreview.note };
    }
    if (invoice.open_balance != null) return null;
    const requestedKey = invoiceKey(invoice.invoice_number);
    const match = (sqlPreview.invoice_matches || []).find((item) => (
      invoiceKey(item.invoice_number) === requestedKey
      || invoiceKey(item.matched_invoice_number) === requestedKey
    ));
    if (match?.found && match.eligible === false) {
      return { label: 'Found in SQL · closed / no open balance', tone: 'amber' as const, title: 'The invoice exists in SQL Accounting, but it has no positive receivable balance available for knock-off.' };
    }
    if (match?.found) {
      return { label: 'Found in SQL · not eligible for knock-off', tone: 'amber' as const, title: 'SQL Accounting returned this invoice, but it is not currently eligible for receivable knock-off.' };
    }
    return { label: 'Not found in SQL', tone: 'red' as const, title: 'No matching invoice number was returned by the connected SQL Accounting company.' };
  };
  const suggestedInvoiceKeys = new Set(invoiceSuggestions.map((invoice) => invoiceKey(invoice.invoice_number)));
  const availableInvoiceCandidates = openInvoiceCandidates
    .filter((candidate) => !invoices.some((invoice) => invoiceKey(invoice.invoice_number) === invoiceKey(candidate.invoice_number)))
    .sort((left, right) => Number(suggestedInvoiceKeys.has(invoiceKey(right.invoice_number))) - Number(suggestedInvoiceKeys.has(invoiceKey(left.invoice_number))));
  const addInvoiceCandidate = (candidate: PaymentInvoice) => setDraft({
    ...draft,
    requested_invoices: [...invoices, { ...candidate, invoice_number_as_printed: candidate.invoice_number, stated_amount: null, requested_amount: candidate.open_balance }],
    allocation_override: [],
  });
  const applyOldestInvoiceSuggestions = () => setDraft({
    ...draft,
    requested_invoices: invoiceSuggestions.map((candidate) => ({
      ...candidate,
      invoice_number_as_printed: candidate.invoice_number,
      stated_amount: null,
      requested_amount: candidate.requested_amount ?? candidate.open_balance,
      requested_amount_source: 'MANUAL',
    })),
    allocations: [],
    allocation_override: [],
  });
  const prepare = async (value = draft) => { await reviewRun(run.id, value as AgentRunData); return generateRun(run.id); };
  const needsExistingReceiptFlow = Boolean(run.output_refs?.payment_post_attempts || run.output_refs?.sql_account_payment || run.output_refs?.payment_submit_interrupted) && run.status !== 'DELIVERY_PENDING';
  const startSubmit = (value = draft) => {
    const scope = JSON.stringify([run.id, run.updated_at, value]);
    if (submitRequest.current?.scope !== scope) submitRequest.current = { scope, id: crypto.randomUUID() };
    return submitPayment(run, value as AgentRunData, submitRequest.current.id);
  };
  const requestPrepare = () => {
    if (displayedUnappliedTotal > 0.005 && !((draft.review_override as Record<string, unknown> | undefined)?.accept_unapplied)) setVarianceModal(true);
    else void act(() => needsExistingReceiptFlow ? prepare() : startSubmit());
  };
  const acceptVariance = () => {
    const next = { ...draft, review_override: { ...((draft.review_override as Record<string, unknown>) || {}), accept_unapplied: true, reason: 'Authorized reviewer accepted the displayed variance as unapplied customer credit.' } };
    setDraft(next); setVarianceModal(false); void act(() => needsExistingReceiptFlow ? prepare(next) : startSubmit(next));
  };
  const saveCustomerAndRefresh = (confirmCustomer = false) => void act(async () => {
    const confirmed = confirmCustomer ? { ...draft, review_override: {
      ...((draft.review_override as Record<string, unknown>) || {}),
      accept_customer_mismatch: true,
      customer_mismatch_customer_code: draft.customer_code || null,
      customer_mismatch_customer_name: draft.customer || null,
      customer_mismatch_reason: 'Reviewer explicitly confirmed this customer mapping.'
    }} : draft;
    await reviewRun(run.id, confirmed as AgentRunData);
    return refreshPaymentPreview(run.id);
  }, 'Checking SQL Accounting for this customer, invoices and existing payments...');

  const mergedInto = Number((run.output_refs as { merged_into_run_id?: number } | null)?.merged_into_run_id);
  if (run.status === 'MERGED' && Number.isInteger(mergedInto) && mergedInto > 0) {
    return <AppLayout pageName={`Payment review #${run.id}`}>
      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <StatusPill status="MERGED" showMeaning />
        <h1 className="text-2xl font-bold">Continue in Review #{mergedInto}</h1>
        <p>This payment image and its related messages are together in Review #{mergedInto}. This earlier record is kept for history.</p>
        <button onClick={() => router.push(`/review/${mergedInto}`)} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white">Open Review #{mergedInto}</button>
      </section>
    </AppLayout>;
  }

  if (awaitingInstruction) {
    return (
      <AppLayout pageName={`Payment review #${run.id}`}>
        <div className="space-y-5">
          <button onClick={() => router.push(router.query.returnTo === 'capture' ? '/capture' : '/review')} className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Back to Review</button>
          {loading && <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading payment evidence...</div>}
          {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

          <header className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-start gap-2"><StatusPill status="WAITING_FOR_INSTRUCTION" showMeaning /><span className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Payment knock-off</span></div>
                <h1 className="mt-3 text-2xl font-bold">Payment evidence received / 付款资料已收到</h1>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{run.source_filename || 'Payment evidence'} · received through {humanLabel(run.source_channel || 'WeChat')}</p>
              </div>
              <div className="text-right text-xs text-[var(--muted-foreground)]"><p>Run #{run.id}</p><p>{formatDateTime(run.received_at)}</p></div>
            </div>
          </header>

          <section role="status" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <h2 className="text-lg font-bold">Waiting for Finance confirmation / 等待财务确认</h2>
                <p className="mt-2 text-sm leading-6">The available payment evidence is saved and its detected details are shown below. Finance needs to confirm receipt before this payment can proceed. Supply further details only where they are missing.</p>
                <p className="mt-2 text-sm leading-6">已收到的付款资料会显示在下方。目前等待财务（如 Yen）核查并回复收款状态；只有实际缺少的资料才需要补充，无需重复发送已有资料。</p>
              </div>
            </div>
          </section>

          <PaymentEvidenceSummary messages={refs.source_context?.messages} runId={run.id} archivedReceipts={run.output_refs?.archived_receipt_files as Array<{file_key:string;filename?:string}>|undefined} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <RunSourcePreview key={run.id} run={run} files={refs.source_files} />
            <div className="space-y-5 xl:self-start">
            <PaymentSourceContextCard context={refs.source_context} run={run} />
            <PaymentEvidenceUploader run={run} busy={busy} act={act} />
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" /> Activity</h2>
              <div className="mt-3 space-y-3">{run.events.slice().reverse().map((event) => <div key={event.id} className="flex gap-2 text-sm"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" /><div><p>{event.message || humanLabel(event.event_type)}</p><p className="text-xs text-[var(--muted-foreground)]">{formatDateTime(event.created_at)}</p></div></div>)}</div>
            </section>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout pageName={`Payment review #${run.id}`}><div className="space-y-5">
    <button onClick={() => router.push(router.query.returnTo === 'capture' ? '/capture' : '/review')} className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Back to Review</button>
    {loading && <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading payment bundle…</div>}
    {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
    <PaymentSubmitProgress runId={run.id} jobId={submitJobId} onFinished={() => { if (submitActive) void act(() => getRun(run.id)); }} />
    <PaymentAutoKnockoff runId={run.id} jobId={submitJobId} onJob={() => { void act(() => getRun(run.id)); }} />
    {busy && !submitActive && <div role="status" className="flex items-center gap-3 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm font-semibold text-cyan-950"><LoaderCircle className="h-5 w-5 animate-spin" /> {sqlCheckRunning ? 'Checking SQL Accounting. You can leave this page and return. No OR is created by this check.' : 'Processing your request. Please wait...'}</div>}

    <header className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-start gap-2"><StatusPill status={submitActive ? "PAYMENT_PROCESSING" : run.display_status || run.status} destination="SQL" showMeaning /><span className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Payment knock-off</span></div><h1 className="mt-3 text-2xl font-bold">{draft.customer ? String(draft.customer) : 'Customer payment'}</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">{draft.customer_code ? `SQL customer ${String(draft.customer_code)}` : 'Customer still needs a live SQL match'} · {slips.length} payment slip{slips.length === 1 ? '' : 's'}</p></div><div className="text-right text-xs text-[var(--muted-foreground)]"><p>Run #{run.id}</p><p>{formatDateTime(run.received_at)}</p></div></div>{paymentCompany.sql_connection_id && <div className="mt-4 grid gap-2 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950 sm:grid-cols-3"><div><span className="block text-xs font-semibold uppercase opacity-70">Payment company</span><b>{paymentCompany.company_name || paymentCompany.company_key}</b></div><div><span className="block text-xs font-semibold uppercase opacity-70">SQL connection</span><b>Connection #{paymentCompany.sql_connection_id}</b></div><div><span className="block text-xs font-semibold uppercase opacity-70">Source group</span><b>{paymentCompany.group_name || paymentCompany.group_id}</b></div></div>}{source.message && <div className="mt-4 rounded-xl bg-[var(--muted)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">SLIP UPDATE instruction</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{source.message}</p></div>}</header>

    <PaymentSourceContextCard context={refs.source_context} run={run} />
    <PaymentEvidenceSummary messages={refs.source_context?.messages} runId={run.id} archivedReceipts={run.output_refs?.archived_receipt_files as Array<{file_key:string;filename?:string}>|undefined} />
    {sqlJobNotice && !busy && <p role="status" className="rounded border border-cyan-300 bg-cyan-50 text-cyan-950 p-3">{sqlJobNotice}</p>}
    <PaymentResolutionActions run={run} busy={busy} act={act}/>
    {Boolean(draft.allocation_instruction) && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <h2 className="font-semibold">Allocation / contra instruction</h2>
      <p className="mt-2 whitespace-pre-wrap">{String(draft.allocation_instruction)}</p>
      <p className="mt-1">Target: {String(draft.allocation_target_name || 'Needs clarification')}. The payer remains separate from this target.</p>
      {Boolean(draft.allocation_requires_review) && <label className="mt-3 flex items-start gap-2"><input type="checkbox" disabled={!editable} checked={Boolean((draft.review_override as Record<string, unknown> | undefined)?.accept_allocation_instruction)} onChange={(event) => setDraft({ ...draft, review_override: { ...((draft.review_override as Record<string, unknown>) || {}), accept_allocation_instruction: event.target.checked } })} /><span>I checked the accounting company, customer and invoice owner against this allocation instruction. This does not create an intercompany transfer.</span></label>}
    </section>}

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="font-semibold">PIC note</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">Record the follow-up reason or internal remark. This note is also shown on the Inbox case.</p>
      <textarea
        disabled={!editable}
        value={String(draft.pic_note || '')}
        onChange={(event) => setDraft({ ...draft, pic_note: event.target.value })}
        placeholder="Example: Waiting for customer to resend the clear bank slip."
        maxLength={1000}
        rows={3}
        className="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60"
      />
    </section>

    <PaymentEvidenceUploader run={run} busy={busy} act={act} />

    {editable && (!sqlReady || postingFailed) && <section role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950"><h2 className="font-semibold">{busy ? 'SQL check in progress' : postingFailed ? 'Previous posting needs to be checked' : sqlPreview.status === 'needs_customer' ? 'SQL connected ? confirm customer' : 'SQL check required'}</h2><p className="mt-2 text-sm">{busy ? 'The previous result is being refreshed. Waiting for the current SQL check to finish.' : postingFailed ? 'SQL did not return a successful result for the previous attempt. An OR may already exist. Retry the SQL check first; matching bank references will be shown before another approval.' : sqlPreview.detail || sqlPreview.note || 'Your payment details are saved. SQL has not verified the latest invoice balances, so posting is blocked.'}</p><button type="button" disabled={busy} onClick={() => saveCustomerAndRefresh()} className="mt-3 rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Checking SQL...' : 'Retry SQL check'}</button><p className="mt-2 text-xs">This only checks SQL; it does not create an OR.</p></section>}
    {Array.isArray(draft.duplicate_references) && draft.duplicate_references.length > 0 && <section role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950"><h2 className="font-semibold">Existing payment found ? check before posting</h2><ul className="mt-2 text-sm">{(draft.duplicate_references as Array<{or_no?: string; bank_reference?: string}>).map((item, index) => <li key={index}>OR {item.or_no || '(number unavailable)'} ? {item.bank_reference || 'Matching bank reference'}</li>)}</ul><p className="mt-2 text-sm">Confirm the existing OR in SQL Accounting. Smartdok will block a second payment using this reference.</p></section>}
    {paymentState.display_status && <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide opacity-70">Payment workflow state</p><h2 className="mt-1 text-lg font-bold">{humanLabel(paymentState.display_status)}</h2></div><div className="flex flex-wrap gap-2 text-xs">{[['Funds', paymentState.funds_status], ['Slip', paymentState.slip_status], ['Customer', paymentState.customer_status], ['Invoices', paymentState.invoice_status], ['Knock-off', paymentState.knock_off_status]].map(([label, value]) => <span key={label} className="rounded-full bg-white px-2.5 py-1 font-semibold">{label}: {humanLabel(value || 'unknown')}</span>)}</div></div>{paymentState.slip_status === 'PENDING' && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><b>Actual payment slip required.</b> This item remains blocked from knock-off until the slip is received; the configured reminder will tag the PIC who sent the status update.</div>}{customerConflict && editable && <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={Boolean((draft.review_override as Record<string, unknown> | undefined)?.accept_customer_mismatch)} onChange={(event) => setDraft({ ...draft, review_override: { ...((draft.review_override as Record<string, unknown>) || {}), accept_customer_mismatch: event.target.checked ? true : undefined, customer_mismatch_customer_code: draft.customer_code || null, customer_mismatch_customer_name: draft.customer || null, customer_mismatch_reason: event.target.checked ? 'Authorized reviewer confirmed the SQL invoice owner despite a different payer/message name.' : undefined } })} /><span><b>Confirm different company names.</b> Live invoice owner: {customerConflict.live_invoice_customer || 'unknown'}; message/slip: {(customerConflict.message_or_slip_candidates || []).join(', ') || 'unknown'}.</span></label>}</section>}

    <section className="grid gap-3 sm:grid-cols-4"><Metric label="Slip total" value={moneyText(displayedSlipTotal)} /><Metric label="Requested invoices" value={moneyText(displayedInvoiceTotal)} /><Metric label="Allocated" value={moneyText(displayedAllocatedTotal)} /><Metric label="Unapplied / variance" value={moneyText(displayedUnappliedTotal)} warning={Math.abs(displayedUnappliedTotal) > 0.005} /></section>

    {!nonReceivable && <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Customer match and learned shorthand</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Confirm the customer once. The detected marking is then learned for this source group; invoice choices always come from the live SQL open-invoice list.</p>{detectedCustomerMarkers.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-[var(--muted-foreground)]">Detected marking:</span>{detectedCustomerMarkers.map((marker) => <span key={marker} className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-900">{marker.replaceAll(' ', '-')}</span>)}</div>}</div>{Boolean(draft.learned_customer_match) && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Matched from reviewed group shorthand</span>}</div><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]"><label className="text-xs font-semibold">Customer/company name<input disabled={!editable} value={String(draft.customer || '')} onChange={(event) => setDraft({ ...draft, customer: event.target.value, customer_candidates: event.target.value ? [event.target.value] : [] })} placeholder="Enter the SQL customer name" className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-normal" /></label><label className="text-xs font-semibold">SQL customer code<input disabled={!editable} value={String(draft.customer_code || '')} onChange={(event) => setDraft({ ...draft, customer_code: event.target.value })} placeholder="Optional; resolved by name" className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-normal" /></label><button type="button" disabled={!editable || busy || !String(draft.customer || '').trim()} onClick={() => saveCustomerAndRefresh(true)} className="self-end rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm this customer & find invoices</button></div></section>}

    {(warnings.length > 0 || run.error_message) && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-semibold">{run.error_message ? 'Review required' : 'Source notes'}</h2>{[run.error_message, ...warnings].filter(Boolean).map((warning, index) => <p key={index} className="mt-1 text-sm">{warning}</p>)}</div></div></section>}

    {missingInvoiceNumbers && <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" /><div><h2 className="font-semibold">No invoice number provided</h2><p className="mt-1 text-sm leading-6">{nexco ? 'NEXCO requires invoice numbers to verify the SQL customer and supplier Project. Ask the PIC to confirm the invoices before creating an OR.' : 'You may still approve the OR as unapplied customer credit. After SQL Accounting creates the OR, Smartdok will automatically message this WeChat group and ask them to provide the invoice document or invoice number for the later knock-off.'}</p></div></div></section>}

    {nexco && <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950">
      <h2 className="font-semibold">NEXCO · OR by receiving supplier</h2>
      <p className="mt-1 text-sm">The listed invoices determine the SQL customer. Each supplier and payment date has a separate OR; Payment Method and Project must agree. Save edits and check SQL to refresh this proposal.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{supplierPlan.map((row,index) => <div key={index} className="rounded-lg bg-white p-3 text-sm">
        <p className="font-semibold">OR {index+1} · Project: {row.project}</p>
        <p>Payment Method: {row.method} · {methods.find(m => m.code===row.method)?.label || 'Confirm supplier'}</p>
        <p>{row.date} · {moneyText(row.amount)} · Slip {row.slips.join(', ')}</p>
        <p className="mt-1 text-xs">Invoices: {invoices.filter(i => i.project===row.project).map(i => i.invoice_number).join(', ') || 'Not verified'}</p>
      </div>)}</div>
      <div className="mt-3 space-y-2">{slips.map((slip,index) => <label key={index} className="block text-sm">Slip {index+1} receiving supplier (from original slip)
        <input value={slip.destination_name || ''} disabled={!editable} placeholder="Recipient / account-holder name" className="mt-1 block w-full rounded border border-cyan-300 bg-white px-3 py-2" onChange={e => updateSlips(slips.map((s,i) => i===index ? {...s,destination_name:e.target.value}:s))} />
      </label>)}</div>
      <p className="mt-3 text-xs">Confirmation must natively reply to the payment message with PAYMENT CONFIRM RECEIVED. Any member may confirm. No automatic slip chase or SLIP UPDATED step is used.</p>
    </section>}

    {excludedSlips.length > 0 && <section className="rounded-xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-950"><h2 className="font-semibold">Company-outbound / accounts-payable evidence</h2><p className="mt-1 text-sm">These transfers were preserved for audit but excluded from the AR knock-off. They cannot create a customer receipt.</p><div className="mt-3 space-y-2">{excludedSlips.map((slip, index) => <div key={`${slip.bank_reference || 'outbound'}-${index}`} className="rounded-lg bg-white p-3 text-sm"><b>{slip.payer_name || 'Company payer'} · {moneyText(slip.amount)}</b><p className="mt-1 text-xs opacity-75">{[slip.payer_account, slip.bank_reference].filter(Boolean).join(' · ') || 'No account/reference read'} · {slip.direction_reason || 'Company source account matched.'}</p></div>)}</div></section>}

    {aiDecision.status && <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950"><h2 className="font-semibold">AI payment decision</h2><p className="mt-1 text-sm">{aiDecision.reason || 'Waiting for SQL facts before deciding this payment.'}</p>{aiDecision.issues?.map((issue, index) => <p className="mt-2 text-sm" key={index}>{issue}</p>)}</section>}
    {slips.some((slip) => slip.destination_bank_name || slip.destination_account || slip.payment_method_match) && <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950"><h2 className="font-semibold">Receiving-bank to SQL method mapping</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{slips.map((slip, index) => <div key={index} className="rounded-lg bg-white/80 p-3 text-sm"><p className="font-semibold">Slip {index + 1}: {[slip.destination_bank_name, slip.destination_account].filter(Boolean).join(' · ') || 'receiving account not readable'}</p><p className="mt-1 text-xs"><span className={['AUTO_MATCHED', 'AI_SELECTED'].includes(slip.payment_method_match?.status || '') ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{slip.payment_method_match?.status ? humanLabel(slip.payment_method_match.status) : 'Not matched'}</span>{slip.payment_method_code ? ` · SQL code ${slip.payment_method_code}` : ''}{slip.payment_method_match?.reason ? ` · ${slip.payment_method_match.reason}` : ''}</p></div>)}</div></section>}

    {source.files && source.files.length > 0 && <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h2 className="font-semibold">Payment-slip evidence</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Each slip remains attached to this audit record.</p><div className="mt-4 grid gap-4 md:grid-cols-2">{source.files.map((file) => <PaymentEvidence key={file.file_key} runId={run.id} file={file} />)}</div></section>}

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div><h2 className="font-semibold">Extracted payments</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Bank reference, date and amount come from each slip. Choose a saved mapping or enter the exact SQL payment-method code immediately before posting. The live SQL description is shown beside the code.</p></div>
      <datalist id="sql-payment-method-codes">{methods.map((method) => <option key={method.code} value={method.code}>{method.label || method.code}{method.bank_account ? ` · ${method.bank_account}` : ''}</option>)}</datalist>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead className="bg-[var(--muted)]"><tr>{['Slip', 'Payment date', 'Bank reference', 'Payer', 'Amount', 'SQL method code', 'SQL method description', 'Action'].map((label) => <th key={label} className="px-3 py-2 text-left">{label}</th>)}</tr></thead><tbody>{slips.map((slip, index) => { const selectedMethod = paymentMethodFor(slip); return <tr key={index} className="border-t border-[var(--border)]"><td className="px-3 py-2 font-semibold">OR {index + 1}<span className="mt-1 block text-[10px] font-normal text-[var(--muted-foreground)]">{humanLabel(slip.evidence_status || slip.image_quality || 'slip received')}</span></td><td className="px-2 py-2"><GenericInput value={slip.payment_date} type="DATE" disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, payment_date: String(value || '') } : row))} /></td><td className="px-2 py-2"><GenericInput value={slip.bank_reference} disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, bank_reference: String(value || '') } : row))} /></td><td className="px-2 py-2"><GenericInput value={slip.payer_name || slip.payer} disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, payer_name: String(value || '') } : row))} /></td><td className="px-2 py-2"><GenericInput value={slip.amount} type="MONEY" disabled={!editable} onChange={(value) => updateSlips(slips.map((row, position) => position === index ? { ...row, amount: Number(value || 0) } : row))} /></td><td className="px-2 py-2"><input list="sql-payment-method-codes" disabled={!editable} value={slip.payment_method_code || methods.find((item) => item.is_default)?.code || ''} onChange={(event) => updateSlips(slips.map((row, position) => position === index ? { ...row, payment_method_code: event.target.value } : row))} placeholder="Choose or enter SQL code" className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2" /></td><td className="px-3 py-2"><span className={selectedMethod ? 'font-semibold' : 'text-amber-700'}>{selectedMethod?.label || 'Unknown SQL method'}</span>{selectedMethod?.bank_account && <span className="mt-1 block text-xs text-[var(--muted-foreground)]">Account {selectedMethod.bank_account}</span>}</td><td className="px-2 py-2"><button type="button" disabled={!editable} onClick={() => removeSlip(index)} title="Remove this wrongly detected slip from the proposal" className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button></td></tr>; })}</tbody></table></div>
    </section>

    {sqlPreview.open_invoice_search?.status === 'FAILED' && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Additional invoices could not be checked. Your selected invoices are retained. Use Search SQL again to retry.</p>}
    {sqlPreview.open_invoice_search?.has_more && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Only part of this customer's open invoices is shown. Add any missing invoice number and use Search SQL again to check it. <button type="button" disabled={!editable || busy} onClick={() => updateInvoices([...invoices, { invoice_number: '', requested_amount: 0, requested_amount_source: 'MANUAL' }])} className="ml-2 rounded-md border border-amber-400 px-2 py-1 font-semibold disabled:opacity-50">Add invoice number</button></p>}

    {(availableInvoiceCandidates.length > 0 || invoiceSuggestions.length > 0) && <section className="rounded-2xl border border-cyan-300 bg-cyan-50 p-5 text-cyan-950"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Open invoices for this SQL customer</h2><p className="mt-1 text-sm">These invoices come from SQL Accounting. Select an invoice when you need to correct the payment instructions.</p></div>{invoiceSuggestions.length > 0 && !sqlPreview.open_invoice_search?.has_more && <button type="button" disabled={!editable} onClick={applyOldestInvoiceSuggestions} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Use oldest open invoice(s)</button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{availableInvoiceCandidates.map((candidate) => { const recommended = suggestedInvoiceKeys.has(invoiceKey(candidate.invoice_number)); return <div key={candidate.invoice_number || candidate.document_date} className={`flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm ${recommended ? 'ring-2 ring-emerald-400' : ''}`}><div><p className="font-semibold">{candidate.invoice_number}{recommended && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">Recommended: oldest first</span>}</p><p className="text-xs opacity-70">{candidate.document_date || 'No date'} · Open {moneyText(candidate.open_balance)}</p></div><button type="button" disabled={!editable} onClick={() => addInvoiceCandidate(candidate)} className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Add</button></div>; })}</div></section>}

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Live invoices and requested amounts</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Correct an invoice number, then search SQL again. The original reading is retained.</p></div>{editable && <button type="button" disabled={busy || invoices.some((invoice) => !invoice.invoice_number?.trim())} onClick={() => saveCustomerAndRefresh()} className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Search SQL again</button>}</div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[var(--muted)]"><tr><th className="px-3 py-2 text-left">Invoice</th><th className="px-3 py-2 text-right">Message amount</th><th className="px-3 py-2 text-right">Live open balance</th><th className="px-3 py-2 text-right">Proposed amount</th><th className="px-3 py-2 text-left">Action</th></tr></thead><tbody>{invoices.map((invoice, index) => { const sqlStatus = invoiceSqlStatus(invoice); return <tr key={index} className="border-t border-[var(--border)]"><td className="px-3 py-3 font-semibold"><input aria-label={`Invoice number ${index + 1}`} value={invoice.invoice_number || ''} maxLength={100} disabled={!editable || busy} placeholder="Enter invoice number" onChange={(event) => editInvoiceNumber(index, event.target.value)} className="w-full min-w-[220px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-semibold" />{invoice.invoice_number_as_printed && invoice.invoice_number_as_printed !== invoice.invoice_number && <span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">Original reading: {invoice.invoice_number_as_printed}</span>}</td><td className="px-3 py-3 text-right">{moneyText(invoice.stated_amount)}</td><td className="px-3 py-3 text-right">{sqlStatus ? <span className={`font-semibold ${sqlStatus.tone === 'red' ? 'text-red-700' : 'text-amber-700'}`} title={sqlStatus.title}>{sqlStatus.label}</span> : moneyText(invoice.open_balance)}</td><td className="px-2 py-2"><GenericInput value={invoice.requested_amount} type="MONEY" disabled={!editable} onChange={(value) => updateInvoices(invoices.map((row, position) => position === index ? { ...row, requested_amount: Number(value || 0), requested_amount_source: 'MANUAL' } : row))} /></td><td className="px-2 py-2"><button type="button" disabled={!editable} onClick={() => removeInvoice(index)} title="Remove this wrongly detected invoice from the proposal" className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button></td></tr>; })}</tbody></table></div></section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h2 className="font-semibold">Proposed Customer Payments / ORs</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">One proposed OR per slip. These amounts are only a preview; SQL Accounting is changed only after approval. AI proposes the allocation using the payment instructions and current SQL balances.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{slips.map((slip, slipIndex) => { const rows = allocations.filter((item) => Number(item.or_index) === slipIndex + 1); const allocated = rows.reduce((sum, item) => sum + Number(item.amount_to_allocate || 0), 0); return <article key={slipIndex} className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Proposed OR {slipIndex + 1}</p><p className="text-xs text-[var(--muted-foreground)]">{slip.bank_reference || 'Reference required'} · {slip.payment_date || 'date required'}</p></div><p className="font-bold">{moneyText(slip.amount)}</p></div><div className="mt-3 space-y-2">{rows.map((allocation) => { const originalIndex = allocations.indexOf(allocation); return <div key={`${allocation.invoice_number}-${originalIndex}`} className="grid grid-cols-[1fr_140px] items-center gap-3 rounded-lg bg-[var(--muted)]/60 p-3"><div><p className="text-sm font-semibold">{allocation.invoice_number}</p><p className="text-xs text-[var(--muted-foreground)]">Remaining {moneyText(allocation.remaining_invoice_balance)}</p></div><GenericInput value={allocation.amount_to_allocate} type="MONEY" disabled={!editable} onChange={(value) => updateAllocations(allocations.map((row, index) => index === originalIndex ? { ...row, amount_to_allocate: Number(value || 0) } : row))} /></div>; })}</div><div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-sm"><span>Proposed allocation</span><b>{moneyText(allocated)}</b></div></article>; })}</div></section>

    {refs.sql_account_payment && <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Posting results</h2><StatusPill status={refs.sql_account_payment.status || 'pending'} /></div>{refs.sql_account_payment.status !== 'created' && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">{refs.sql_account_payment.detail || refs.sql_account_payment.note || 'SQL Accounting did not create the receipt.'}</p>}<div className="mt-3 space-y-2">{(refs.sql_account_payment.receipts || []).map((receipt, index) => { const orNo = receipt.receipt?.or_no || receipt.or_no; const allocationCount = receipt.allocations?.length || receipt.invoice_allocations?.length || 0; return <div key={orNo || index} className="flex items-center justify-between rounded-lg bg-[var(--muted)] p-3 text-sm"><span><b>{orNo || `OR ${index + 1}`}</b><span className="ml-2 text-[var(--muted-foreground)]">{receipt.detail || `${allocationCount} invoice allocation(s)`}</span></span><span className="font-semibold">{receipt.status || 'created'}</span></div>; })}</div>{refs.sql_official_receipts && refs.sql_official_receipts.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{refs.sql_official_receipts.map((file) => <PaymentEvidence key={file.file_key} runId={run.id} file={file} />)}</div>}{refs.notify && <p className={`mt-3 rounded-lg p-3 text-sm ${refs.notify.status === 'sent' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>{refs.notify.status === 'sent' ? (refs.notify.delivery_type === 'acknowledgement' ? 'Completion acknowledgement was sent to the originating WeChat group.' : 'Official SQL OR PDFs were returned to the originating WeChat group.') : `Completion delivery pending: ${refs.notify.detail || refs.notify.note || 'the source channel has not been notified yet'}`}</p>}</section>}

    <PaymentInvoiceFollowup followup={refs.invoice_chase} acknowledgementSent={refs.notify?.status === 'sent'} />
    <PaymentInvoiceIssuance run={run} busy={busy} onApprove={(enabled) => act(() => setInvoiceWaitApproval(run.id, enabled))} />

    {refs.notify?.source_target && <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="font-semibold">Completion reply target</h3>
      <p className="mt-2 text-sm">Sender: {refs.notify.source_target.sender_name || 'Unknown'}</p>
      <p className="mt-1 break-all text-xs text-[var(--muted-foreground)]">Message ID: {refs.notify.source_target.message_id || refs.notify.reply_to_message_id}</p>
      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--muted)] p-3 text-sm">{refs.notify.source_target.text || 'Source message text unavailable'}</pre>
      <p className="mt-2 text-sm">Reply: {refs.notify.message}</p>
      {refs.notify.detail && <p className="mt-2 text-sm text-amber-800">Last result: {refs.notify.detail}</p>}
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">The runner must locate and verify this original message before quoting. Retrying delivery does not create another OR.</p>
    </section>}
    <section className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/95 p-4 shadow-lg backdrop-blur">
      {['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(run.status) && <>
        <button disabled={busy} onClick={() => void act(() => reviewRun(run.id, draft as AgentRunData))} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Save corrections</button>
        {needsExistingReceiptFlow ? <>
          {run.status === 'PENDING_REVIEW' && <button disabled={busy || !sqlReady} onClick={requestPrepare} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Validate existing receipt</button>}
          {canApprove && <button disabled={busy || !sqlReady} onClick={() => void act(() => approveRun(run.id, draft as AgentRunData))} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve reviewed receipt recovery</button>}
        </> : <button disabled={busy || !slips.length} onClick={requestPrepare} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> Confirm & knock off</button>}
        {!needsExistingReceiptFlow && <span className="text-xs text-[var(--muted-foreground)]">Checks SQL, creates OR and sends confirmation in the background.</span>}
      </>}
      {run.status === 'DELIVERY_PENDING' && <button disabled={busy} onClick={() => void act(() => startSubmit())} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Retry confirmation only</button>}
      {editable && <button disabled={busy} onClick={() => void act(() => rejectRun(run.id, 'Rejected by payment reviewer'))} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>}
      {run.status === 'COMPLETED' && <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Posted and confirmation sent</span>}
    </section>
  </div>{varianceModal && <ReviewConfirmationModal title={missingInvoiceNumbers ? "Create OR without an invoice number?" : "Accept unapplied customer credit?"} confirmLabel={needsExistingReceiptFlow ? "Accept & validate" : "Confirm & create OR"} tone="warning" busy={busy} onCancel={() => setVarianceModal(false)} onConfirm={acceptVariance}><p>{missingInvoiceNumbers ? <>The full payment of <b>{moneyText(displayedUnappliedTotal)}</b> will remain unapplied. After the OR confirmation reaches the source group, Smartdok will follow up every 24 hours until the invoice document or number is provided.</> : <>The slips exceed the selected invoice allocations by <b>{moneyText(displayedUnappliedTotal)}</b>. Continuing records an explicit reviewer override and allows SQL Accounting to retain this amount as unapplied customer credit. It will never be accepted silently.</>}</p></ReviewConfirmationModal>}</AppLayout>;
}

function PaymentEvidenceUploader({ run, busy, act }: { run: AgentRun; busy: boolean; act: (fn: () => Promise<AgentRun>, message?: string) => Promise<void> }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedScrollRef = useRef<{ element: HTMLElement; top: number } | null>(null);
  const closed = ['COMPLETED', 'DELIVERY_PENDING', 'REJECTED'].includes(run.status);
  const supplementalCount = Array.isArray((run.output_refs as { supplemental_source_files?: unknown[] } | null)?.supplemental_source_files)
    ? ((run.output_refs as { supplemental_source_files?: unknown[] }).supplemental_source_files || []).length
    : 0;

  const restoreScroll = useCallback(() => {
    const saved = savedScrollRef.current;
    if (!saved) return;
    window.requestAnimationFrame(() => {
      saved.element.scrollTop = saved.top;
      savedScrollRef.current = null;
    });
  }, []);

  useEffect(() => {
    const onWindowFocus = () => {
      if (savedScrollRef.current) window.setTimeout(restoreScroll, 0);
    };
    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
  }, [restoreScroll]);

  const selectFiles = (incoming: File[]) => {
    const selection = appendPaymentEvidence(files, incoming);
    setFiles(selection.files);
    setFileError(selection.message);
  };

  const openPicker = () => {
    if (closed || busy) return;
    const scrollContainer = sectionRef.current?.closest('main');
    if (scrollContainer instanceof HTMLElement) {
      savedScrollRef.current = { element: scrollContainer, top: scrollContainer.scrollTop };
    }
    inputRef.current?.click();
  };

  const dropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (closed || busy) return;
    selectFiles(Array.from(event.dataTransfer.files || []));
  };

  const upload = () => {
    if (files.length === 0) return;
    const selected = files;
    void act(async () => {
      const updated = await addPaymentEvidence(run.id, selected);
      setFiles([]);
      setFileError(null);
      return updated;
    }, 'Uploading clearer payment evidence and rechecking the payment...');
  };

  return (
    <section ref={sectionRef} className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Add clearer payment evidence</h2>
          <p className="mt-1 text-sm">Upload one or more replacement photos or PDFs to this same payment. Original group evidence stays in the audit record; a ready review is extracted again automatically.</p>
          <p className="mt-1 text-xs opacity-75">补传一张或多张较清晰的付款凭证，不会建立重复 payment，也不会覆盖原始群聊记录。</p>
        </div>
        {supplementalCount > 0 && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800">{supplementalCount} supplemental file{supplementalCount === 1 ? '' : 's'}</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff"
        multiple
        disabled={closed || busy}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files || []);
          if (selected.length > 0) selectFiles(selected);
          event.currentTarget.value = '';
          restoreScroll();
        }}
      />

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div
          role="button"
          tabIndex={closed || busy ? -1 : 0}
          aria-disabled={closed || busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={(event) => { event.preventDefault(); if (!closed && !busy) setDragActive(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = closed || busy ? 'none' : 'copy'; }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
          }}
          onDrop={dropFiles}
          className={`min-w-0 rounded-xl border-2 border-dashed px-4 py-4 transition-colors ${dragActive ? 'border-cyan-700 bg-cyan-100 dark:bg-cyan-900/50' : 'border-cyan-400 bg-white/70 dark:bg-cyan-950/20'} ${closed || busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-cyan-600'}`}
          onClick={openPicker}
        >
          <div className="flex min-w-0 items-center gap-3">
            <UploadCloud className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Drop images or PDFs here, or <span className="underline">choose files</span></p>
              <p className="mt-0.5 break-words text-xs opacity-75" aria-live="polite">
                {files.length > 0 ? `${files.length} / 20 selected. Add more files or remove a selection below.` : 'Up to 20 files per upload. Drop files together or add them one at a time.'}
              </p>
            </div>
          </div>
        </div>
        <button type="button" disabled={closed || busy || files.length === 0} onClick={upload} className="w-full whitespace-nowrap rounded-md bg-cyan-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 lg:w-auto">
          Upload & {Boolean(run.awaiting_instruction || (run.output_refs as { awaiting_instruction?: boolean } | null)?.awaiting_instruction) ? 'save' : 'recheck'}
        </button>
      </div>
      {files.length > 0 && <ul className="mt-3 space-y-1">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-3 py-2 text-sm"><span className="break-all">{file.name}</span><button type="button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => { setFiles(files.filter((_file, position) => position !== index)); setFileError(null); }} className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50">Remove</button></li>)}</ul>}
      {fileError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">{fileError}</p>}
      {closed && <p className="mt-2 text-xs font-semibold">This payment is already closed; its evidence is locked for audit.</p>}
    </section>
  );
}

function RunSourcePreview({ run, files }: { run: AgentRun; files?: ExternalDocument[] }) {
  const retained = Array.isArray(files) ? files.filter((file) => file?.file_key) : [];
  if (retained.length > 1) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div><h2 className="flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4" /> All payment evidence</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{retained.length} original files are attached to this review.</p></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{retained.map((file) => <PaymentEvidence key={file.file_key} runId={run.id} file={file} />)}</div>
      </section>
    );
  }
  return <SingleRunSourcePreview run={run} />;
}

function SingleRunSourcePreview({ run }: { run: AgentRun }) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState('');
  const [loading, setLoading] = useState(Boolean(run.source_file_s3_key));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!run.source_file_s3_key) return undefined;
    let active = true;
    let objectUrl: string | null = null;
    getRunSource(run.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setMime(blob.type || '');
        setUrl(objectUrl);
      })
      .catch((previewError) => active && setError((previewError as Error).message || 'Could not load the payment image preview.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [run.id, run.source_file_s3_key]);

  const extension = String(run.source_filename || '').split('.').pop()?.toLowerCase();
  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension || '');
  const isPdf = mime === 'application/pdf' || extension === 'pdf';

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <div><h2 className="flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4" /> Payment image preview</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{run.source_filename || 'Received payment evidence'}</p></div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700"><Download className="h-4 w-4" /> Open original</a>}
      </div>
      {loading && <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading preview...</div>}
      {!loading && error && <div className="m-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      {!loading && !error && url && isImage && <Image src={url} alt={`Preview of ${run.source_filename || 'payment evidence'}`} width={1600} height={1200} unoptimized className="max-h-[760px] min-h-80 w-full bg-slate-100 object-contain dark:bg-slate-950" />}
      {!loading && !error && url && isPdf && <iframe src={url} title={`Preview of ${run.source_filename || 'payment evidence'}`} className="h-[720px] w-full bg-white" />}
      {!loading && !error && url && !isImage && !isPdf && <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><FileText className="h-12 w-12 text-[var(--muted-foreground)]" /><p className="text-sm text-[var(--muted-foreground)]">This file type cannot be previewed here.</p><a href={url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700">Open the original file</a></div>}
      {!loading && !error && !url && <p className="p-5 text-sm text-[var(--muted-foreground)]">No retained image is available for this run.</p>}
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className={`rounded-xl border p-4 ${warning ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-[var(--border)] bg-[var(--card)]'}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>; }

function PaymentEvidence({ runId, file, autoLoad = false }: { runId: number; file: ExternalDocument; autoLoad?: boolean }) {
  const [requestCount, setRequestCount] = useState(autoLoad ? 1 : 0);
  const requestKey = JSON.stringify([runId, file.file_key, file.content_type, requestCount]);
  const [result, setResult] = useState<{ key: string; url: string | null; mime: string; error: string | null } | null>(null);
  const current = result?.key === requestKey ? result : null;
  const url = current?.url || null;
  const mime = current?.mime || file.content_type || '';
  const error = current?.error || null;
  const loading = requestCount > 0 && !current;
  useEffect(() => {
    if (!requestCount) return;
    let active = true;
    let objectUrl: string | null = null;
    void getRunFile(runId, file.file_key).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setResult({ key: requestKey, url: objectUrl, mime: blob.type || file.content_type || '', error: null });
    }).catch((err: unknown) => {
      if (active) setResult({ key: requestKey, url: null, mime: '', error: err instanceof Error ? err.message : 'Unable to load this file.' });
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [runId, file.file_key, file.content_type, requestCount, requestKey]);
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.filename);
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(file.filename);
  return <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]/40">
    {error ? <div role="alert" className="p-4 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => setRequestCount((value) => value + 1)} className="mt-2 font-semibold underline">Retry preview</button></div>
      : url && isImage ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open original ${file.filename}`}><img src={url} alt={file.filename} onError={() => setResult((previous) => previous?.key === requestKey ? { ...previous, error: 'The image could not be displayed. Retry the preview.' } : previous)} className="max-h-96 w-full object-contain bg-white" /></a>
      : url && isPdf ? <iframe src={url} title={`Preview of ${file.filename}`} className="h-96 w-full bg-white" />
      : url ? <p className="p-4 text-sm">Preview unavailable for this file type. Open the original below.</p>
      : <button type="button" disabled={loading} onClick={() => setRequestCount((value) => value + 1)} className="flex h-40 w-full items-center justify-center gap-2 bg-[var(--muted)] text-sm font-semibold"><FileText className="h-10 w-10 text-[var(--muted-foreground)]" />{loading ? 'Loading evidence?' : 'Load preview'}</button>}
    <div className="flex items-center justify-between gap-3 p-3"><span className="truncate text-sm font-semibold">{file.filename}</span>{url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700"><Download className="h-3.5 w-3.5" /> Open original</a>}</div>
  </article>;
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

function PaymentSourceContextCard({ context, run }: { context?: PaymentSourceContext; run: AgentRun }) {
  const senders = (context?.senders || []).map((sender) => sender.name && sender.id && sender.name !== sender.id ? `${sender.name} (${sender.id})` : sender.name || sender.id).filter(Boolean).join(', ');
  const messages = context?.messages || [];
  const fileRefs = (run.output_refs || {}) as { source_files?: ExternalDocument[]; supplemental_source_files?: ExternalDocument[] };
  const historyFiles = [...(fileRefs.source_files || []), ...(fileRefs.supplemental_source_files || [])];
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"><h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" /> Source context</h2><dl className="mt-3 space-y-2 text-sm"><Meta label="Channel" value={humanLabel(context?.source_type || run.source_channel || 'unknown')} /><Meta label="Group" value={context?.group_name || context?.channel_ref || String(run.output_refs?.source_channel_ref || 'Not provided')} /><Meta label="Sender" value={senders || 'Not provided'} /><Meta label="Received" value={formatDateTime(context?.first_received_at || run.received_at)} /><Meta label="Message IDs" value={(context?.capture_event_ids || []).join(', ') || run.source_ref || 'Not provided'} /></dl>{messages.length > 0 && <div className="mt-4 border-t border-[var(--border)] pt-4"><h3 className="text-sm font-semibold">Complete channel history</h3><div className="mt-3 space-y-3">{messages.map((message) => { const failed = message.ai_failure; const intent = message.ai_analysis?.intent; return <article key={message.capture_event_id} className={`rounded-lg border p-3 text-sm ${failed ? 'border-red-300 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100' : 'border-[var(--border)] bg-[var(--muted)]/40'}`}><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]"><b className="text-[var(--foreground)]">{message.sender?.name || message.sender?.id || 'Unknown sender'}</b><span>{formatDateTime(message.received_at)} · #{message.capture_event_id}</span></div>{message.quoted?.message_id && <div className="mt-2 rounded border-l-4 border-cyan-400 bg-cyan-50 p-2 text-xs text-cyan-950"><b>Replying to:</b> {message.quoted.preview || message.quoted.message_id}</div>}<p className="mt-2 whitespace-pre-wrap leading-5">{message.text || '[Attachment only]'}</p>{(message.filenames || []).length > 0 && <p className="mt-2 text-xs font-semibold">Files: {(message.filenames || []).join(', ')}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2">{paymentFilesForMessage(historyFiles, message.capture_event_id).map((file) => <PaymentEvidence key={file.file_key} runId={run.id} file={file} autoLoad />)}</div>{(message.payment_status_history || []).map((status, index) => <p key={index} className="mt-2 text-xs font-semibold">Status update: {humanLabel(status.status_code || 'unspecified')} ? Funds: {humanLabel(status.funds_status || 'unconfirmed')} ? Slip: {humanLabel(status.declared_slip_status || 'unknown')}{['IGNORED', 'FILTERED', 'RETRACTED', 'REJECTED'].includes(message.status || '') ? ' ? Excluded from current state' : ''}</p>)}{intent && <p className="mt-2 text-xs text-[var(--muted-foreground)]">AI: {humanLabel(intent.intent_type || 'other')} · {humanLabel(intent.funds_status || 'unconfirmed')} · {Math.round(Number(message.ai_analysis?.confidence || 0) * 100)}%</p>}{failed && <p className="mt-2 text-xs font-semibold">{failed.message || 'AI analysis failed. Reanalyse is available.'}</p>}</article>; })}</div></div>}</section>;
}

function humanLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString() : '—'; }
function StatusPill({ status, destination = 'SQL', showMeaning = false }: { status: string; destination?: ApprovalDestination; showMeaning?: boolean }) { return <AutomationStatusBadge status={status} destination={destination} showMeaning={showMeaning} />; }
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
  expected_attachments?: Array<{ type?: string; label?: string; required?: boolean }>;
}

interface OutsourcedWhatsAppDelivery {
  status?: string;
  group_name?: string | null;
  test_mode?: boolean;
  source_attached?: boolean;
  message_id?: string | null;
}

interface ExternalDocument {
  capture_event_id?: number;
  filename: string;
  file_key: string;
  kind?: string;
  content_type?: string;
  size?: number;
}

interface SupplierVerificationCheck {
  code: string;
  label: string;
  status: 'PASSED' | 'FAILED';
  expected?: unknown;
  actual?: unknown;
  line?: number | null;
}

interface SupplierDocumentVerification {
  status: 'PASSED' | 'FAILED';
  original_source_comparisons?: Array<{filename?:string;status:string;reason?:string;checks?:Array<{category:string;status:string;original_evidence:string;returned_evidence:string;reason:string}>}>;
  summary?: { documents?: number; checks?: number; passed?: number; failed?: number };
  documents?: Array<{
    filename?: string;
    kind?: string;
    document_type?: string;
    document_number?: string;
    status?: 'PASSED' | 'FAILED';
    checks?: SupplierVerificationCheck[];
  }>;
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
