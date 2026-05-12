'use client';

import { AppLayout } from "@/components/layout";
import { useOrganization } from "@/lib/OrganizationContext";
import { useToast } from "@/lib/toast";
import {
  autoReconcileBank,
  deleteAllPaymentGatewayBankReconciliationLinks,
  getPaymentGatewayReconciliation,
  listBankStatements,
  listPaymentGatewayBankReconciliationLinks,
  listPaymentGatewaySettlementRows,
  listPaymentGatewayTransactions,
  type AutoReconcileBankResponse,
  type BankStatement,
  type PaymentGatewayBankReconciliationLink,
  type PaymentGatewayBatch,
  type PaymentGatewayFile,
  type PaymentGatewaySettlementRow,
  type PaymentGatewayTransactionRow,
} from "@/services";
import { ArrowLeft, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

interface DetailData {
  batch: PaymentGatewayBatch;
  files: PaymentGatewayFile[];
  settlementGroups: SettlementGroup[];
}

interface SettlementGroup {
  settlement_id?: string;
  settlement_totals?: {
    gross_amount?: number | string;
    net_amount?: number | string;
    settlement_row_count?: number;
  };
  bank_reconciliation?: {
    linked_settlement_row_count?: number;
    unlinked_settlement_row_count?: number;
    matched_count?: number;
    warning_count?: number;
    linked_net_amount?: number | string;
    unlinked_net_amount?: number | string;
    links?: PaymentGatewayBankReconciliationLink[];
  };
  matched_links?: unknown[];
  warning_links?: unknown[];
  unmatched_successful_transactions?: PaymentGatewayTransactionRow[];
  unmatched_settlement_rows?: PaymentGatewaySettlementRow[];
}

type MatchStatusFilter = 'matched' | 'warning' | 'unmatched';
type GatewayStatusFilter = 'Sales' | 'Failed' | 'all';
type MasterColumnKey =
  | 'matchStatus'
  | 'bankStatus'
  | 'remark'
  | 'transactionId'
  | 'merchantStatus'
  | 'customer'
  | 'transactionDate'
  | 'settlementId'
  | 'transactionAmount'
  | 'settlementGross'
  | 'settlementFee'
  | 'settlementNet'
  | 'bankTransaction'
  | 'bankAmount';

interface MasterMergedRow {
  id: string;
  transaction?: PaymentGatewayTransactionRow;
  settlement?: PaymentGatewaySettlementRow;
  matchStatus: string;
  bankStatus: string;
  remark: string;
  bankLink?: PaymentGatewayBankLinkLike;
}

type PaymentGatewayBankLinkLike = PaymentGatewayBankReconciliationLink | NonNullable<PaymentGatewayTransactionRow['bank_link']> | NonNullable<PaymentGatewaySettlementRow['bank_link']>;

function textValue(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return '';
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
}

function numberValue(row: Record<string, unknown> | undefined, keys: string[]) {
  const value = textValue(row, keys);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function arrayValue<T>(data: Record<string, unknown>, keys: string[]): T[] {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function formatDate(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatCurrency(value?: number | string, currency = 'MYR') {
  if (value === undefined || value === null || value === '') return '-';
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `${currency} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDifference(value: number, currency = 'MYR') {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatCurrency(value, currency)}`;
}

function providerLabel(provider?: string) {
  if (provider === 'payex') return 'Payex';
  if (provider === 'foodpanda') return 'Foodpanda';
  if (provider === 'grab') return 'Grab';
  return provider || 'Provider';
}

function isPlatformProvider(provider?: string) {
  return provider === 'foodpanda' || provider === 'grab';
}

function getTransactionId(row?: PaymentGatewayTransactionRow | PaymentGatewaySettlementRow) {
  return textValue(row, ['transaction_id', 'TransactionId', 'transactionId', 'provider_transaction_id']);
}

function getSettlementId(row?: PaymentGatewayTransactionRow | PaymentGatewaySettlementRow) {
  return textValue(row, ['settlement_id', 'SettlementId', 'settlementId']);
}

function getRowSettlementId(row: MasterMergedRow) {
  return getSettlementId(row.transaction || row.settlement);
}

function getGatewayStatus(row?: PaymentGatewayTransactionRow) {
  return textValue(row, ['status', 'Status']) || '-';
}

function getCustomer(row?: PaymentGatewayTransactionRow | PaymentGatewaySettlementRow) {
  return textValue(row, ['customer_name', 'customer', 'merchant']);
}

function getTransactionDate(row?: PaymentGatewayTransactionRow) {
  return textValue(row, ['transaction_date', 'TransactionDate', 'date', 'Date']);
}

function getTransactionAmount(row?: PaymentGatewayTransactionRow) {
  return numberValue(row, ['amount', 'Amount', 'gross_amount']);
}

function getSettlementGross(row?: PaymentGatewaySettlementRow) {
  return numberValue(row, ['gross_amount', 'gross', 'Gross']);
}

function getSettlementFee(row?: PaymentGatewaySettlementRow) {
  return numberValue(row, ['mdr_amount', 'fee', 'Fee']);
}

function getSettlementNet(row?: PaymentGatewaySettlementRow) {
  return numberValue(row, ['net_amount', 'net', 'Net']);
}

function getCurrency(row?: PaymentGatewayTransactionRow | PaymentGatewaySettlementRow) {
  return textValue(row, ['currency', 'Currency']) || 'MYR';
}

function rowMatchStatus(transaction?: PaymentGatewayTransactionRow, settlement?: PaymentGatewaySettlementRow) {
  const link = transaction?.link || settlement?.link;
  return link?.match_status || (transaction && settlement ? 'matched' : 'unmatched');
}

function rowBankLink(transaction?: PaymentGatewayTransactionRow, settlement?: PaymentGatewaySettlementRow) {
  return transaction?.bank_link || settlement?.bank_link || undefined;
}

function rowBankStatus(transaction?: PaymentGatewayTransactionRow, settlement?: PaymentGatewaySettlementRow) {
  const link = rowBankLink(transaction, settlement);
  return link?.match_status || (link ? 'matched' : 'unmatched');
}

function toggleFilterValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function rowRemark(transaction?: PaymentGatewayTransactionRow, settlement?: PaymentGatewaySettlementRow) {
  const link = transaction?.link || settlement?.link;
  const bankLink = rowBankLink(transaction, settlement);
  const notes = textValue(link as Record<string, unknown> | undefined, ['notes', 'remark', 'reason']);
  const bankNotes = textValue(bankLink as Record<string, unknown> | undefined, ['notes', 'remark', 'reason']);

  if (!transaction && settlement) return 'Settlement row has no matching transaction';
  if (transaction && !settlement) return 'Transaction has no matching settlement row';
  if (!bankLink) return 'No bank transaction linked';
  if (notes) return notes;
  if (bankNotes) return bankNotes;
  return 'Matched';
}

function bankTransactionAmount(link?: PaymentGatewayBankLinkLike) {
  const tx = link?.bank_transaction as Record<string, unknown> | undefined;
  const fromNested = numberValue(tx, ['credit_amount', 'debit_amount']);
  if (fromNested !== undefined) return fromNested;
  return numberValue(link as Record<string, unknown> | undefined, ['bank_transaction_amount', 'allocated_amount', 'selected_net_amount']);
}

function bankTransactionDescription(link?: PaymentGatewayBankLinkLike) {
  const tx = link?.bank_transaction as Record<string, unknown> | undefined;
  return textValue(tx, ['description', 'payor', 'reference_number']);
}

function StatusBadge({ status }: { status?: string }) {
  const color =
    status === 'ready' || status === 'matched' ? 'var(--success)' :
    status === 'warning' ? 'var(--warning)' :
    status === 'failed' || status === 'unmatched' ? 'var(--error)' :
    'var(--muted-foreground)';
  return (
    <span className="inline-flex rounded px-2 py-1 text-xs font-medium capitalize" style={{ background: color, color: 'white' }}>
      {status || 'unknown'}
    </span>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{value}</div>
    </div>
  );
}

export default function PaymentGatewayReconciliationDetail() {
  const router = useRouter();
  const { id } = router.query;
  const batchId = typeof id === 'string' ? Number(id) : undefined;
  const { showToast } = useToast();
  const { selectedOrganizationId } = useOrganization();

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [transactions, setTransactions] = useState<PaymentGatewayTransactionRow[]>([]);
  const [settlementRows, setSettlementRows] = useState<PaymentGatewaySettlementRow[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [selectedBankStatementIds, setSelectedBankStatementIds] = useState<Set<number>>(new Set());
  const [bankLinks, setBankLinks] = useState<PaymentGatewayBankReconciliationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRowsLoading, setIsRowsLoading] = useState(false);
  const [isReconcilingBank, setIsReconcilingBank] = useState(false);
  const [isClearingBankLinks, setIsClearingBankLinks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<GatewayStatusFilter>('all');
  const [selectedSettlementId, setSelectedSettlementId] = useState('all');
  const [matchStatusFilters, setMatchStatusFilters] = useState<MatchStatusFilter[]>([]);
  const [bankStatusFilters, setBankStatusFilters] = useState<MatchStatusFilter[]>([]);
  const [search, setSearch] = useState('');
  const [dateToleranceDays, setDateToleranceDays] = useState(5);
  const [amountTolerancePct, setAmountTolerancePct] = useState(5);
  const [useLlm, setUseLlm] = useState(true);
  const [autoBankResult, setAutoBankResult] = useState<AutoReconcileBankResponse['data'] | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<MasterColumnKey, boolean>>({
    matchStatus: true,
    bankStatus: true,
    remark: true,
    transactionId: true,
    merchantStatus: true,
    customer: true,
    transactionDate: true,
    settlementId: true,
    transactionAmount: true,
    settlementGross: false,
    settlementFee: false,
    settlementNet: true,
    bankTransaction: true,
    bankAmount: true,
  });

  useEffect(() => {
    if (batchId) {
      loadPageData();
      loadBankStatements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, selectedOrganizationId]);

  useEffect(() => {
    if (batchId && detail) {
      loadRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, detail, selectedOrganizationId, statusFilter]);

  const masterRows = useMemo(() => {
    const settlementByTransactionId = new Map<string, PaymentGatewaySettlementRow>();
    settlementRows.forEach((row) => {
      const transactionId = getTransactionId(row);
      if (transactionId) settlementByTransactionId.set(transactionId, row);
    });

    const usedSettlementIds = new Set<number>();
    const rows: MasterMergedRow[] = transactions.map((transaction) => {
      const transactionId = getTransactionId(transaction);
      const settlement = transactionId ? settlementByTransactionId.get(transactionId) : undefined;
      if (settlement) usedSettlementIds.add(settlement.id);
      return {
        id: `transaction-${transaction.id}`,
        transaction,
        settlement,
        matchStatus: rowMatchStatus(transaction, settlement),
        bankStatus: rowBankStatus(transaction, settlement),
        remark: rowRemark(transaction, settlement),
        bankLink: rowBankLink(transaction, settlement),
      };
    });

    settlementRows.forEach((settlement) => {
      if (usedSettlementIds.has(settlement.id)) return;
      rows.push({
        id: `settlement-${settlement.id}`,
        settlement,
        matchStatus: rowMatchStatus(undefined, settlement),
        bankStatus: rowBankStatus(undefined, settlement),
        remark: rowRemark(undefined, settlement),
        bankLink: rowBankLink(undefined, settlement),
      });
    });

    return rows;
  }, [settlementRows, transactions]);

  const settlementGroupOptions = useMemo(() => {
    const settlementIds = new Set<string>();
    detail?.settlementGroups.forEach((group) => {
      if (group.settlement_id) settlementIds.add(group.settlement_id);
    });
    masterRows.forEach((row) => {
      const settlementId = getRowSettlementId(row);
      if (settlementId) settlementIds.add(settlementId);
    });
    return Array.from(settlementIds).sort();
  }, [detail?.settlementGroups, masterRows]);

  const settlementScopedRows = useMemo(() => {
    if (selectedSettlementId === 'all') return masterRows;
    return masterRows.filter((row) => getRowSettlementId(row) === selectedSettlementId);
  }, [masterRows, selectedSettlementId]);

  const filteredMasterRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return settlementScopedRows.filter((row) => {
      if (matchStatusFilters.length > 0 && !matchStatusFilters.includes(row.matchStatus as MatchStatusFilter)) return false;
      if (bankStatusFilters.length > 0 && !bankStatusFilters.includes(row.bankStatus as MatchStatusFilter)) return false;
      if (!needle) return true;
      const transaction = row.transaction;
      const settlement = row.settlement;
      return [
        getTransactionId(transaction || settlement),
        getSettlementId(transaction || settlement),
        getGatewayStatus(transaction),
        getCustomer(transaction || settlement),
        textValue(transaction || settlement, ['reference_number', 'ReferenceNumber']),
        textValue(transaction || settlement, ['description', 'Description']),
        bankTransactionDescription(row.bankLink),
        row.remark,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [bankStatusFilters, matchStatusFilters, search, settlementScopedRows]);

  const settlementTally = useMemo(() => {
    const transactionAmount = filteredMasterRows.reduce((sum, row) => sum + (getTransactionAmount(row.transaction) ?? 0), 0);
    const settlementAmount = filteredMasterRows.reduce((sum, row) => sum + (getSettlementNet(row.settlement) ?? 0), 0);
    return {
      displayedCount: filteredMasterRows.length,
      transactionAmount,
      settlementAmount,
      difference: transactionAmount - settlementAmount,
    };
  }, [filteredMasterRows]);

  async function loadPageData() {
    if (!batchId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await getPaymentGatewayReconciliation(batchId);
      const data = response.data;
      const dataRecord = data as Record<string, unknown>;
      setDetail({
        batch: data.batch,
        files: arrayValue<PaymentGatewayFile>(dataRecord, ['files']),
        settlementGroups: arrayValue<SettlementGroup>(dataRecord, ['settlement_groups', 'groups']),
      });
      await loadBankLinks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load platform and merchant reconciliation';
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRows() {
    if (!batchId) return;

    setIsRowsLoading(true);
    try {
      const baseTransactionParams = {
        page: 1,
        page_size: 1000,
        status: statusFilter === 'all' ? undefined : statusFilter,
      };

      const [matchedTransactionsResponse, unmatchedTransactionsResponse, matchedSettlementsResponse, unmatchedSettlementsResponse] = await Promise.all([
        listPaymentGatewayTransactions(batchId, { ...baseTransactionParams, matched: true }),
        listPaymentGatewayTransactions(batchId, { ...baseTransactionParams, matched: false }),
        listPaymentGatewaySettlementRows(batchId, { page: 1, page_size: 1000, matched: true }),
        listPaymentGatewaySettlementRows(batchId, { page: 1, page_size: 1000, matched: false }),
      ]);

      const transactionMap = new Map<number, PaymentGatewayTransactionRow>();
      [...(matchedTransactionsResponse.data || []), ...(unmatchedTransactionsResponse.data || [])].forEach((row) => transactionMap.set(row.id, row));

      const settlementMap = new Map<number, PaymentGatewaySettlementRow>();
      [...(matchedSettlementsResponse.data || []), ...(unmatchedSettlementsResponse.data || [])].forEach((row) => settlementMap.set(row.id, row));

      setTransactions(Array.from(transactionMap.values()));
      setSettlementRows(Array.from(settlementMap.values()));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load reconciliation rows', { type: 'error' });
    } finally {
      setIsRowsLoading(false);
    }
  }

  async function loadBankStatements() {
    try {
      const response = await listBankStatements({ page: 1, page_size: 100 });
      const statements = response.data || [];
      setBankStatements(statements);
      setSelectedBankStatementIds((prev) => {
        if (prev.size > 0 || statements.length === 0) return prev;
        return new Set([statements[0].id]);
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load bank statements', { type: 'error' });
    }
  }

  async function loadBankLinks() {
    if (!batchId) return;
    try {
      const response = await listPaymentGatewayBankReconciliationLinks(batchId);
      setBankLinks(response.data || []);
    } catch {
      setBankLinks([]);
    }
  }

  function toggleBankStatement(statementId: number) {
    setSelectedBankStatementIds((prev) => {
      const next = new Set(prev);
      if (next.has(statementId)) next.delete(statementId);
      else next.add(statementId);
      return next;
    });
  }

  async function handleAutoReconcileBank() {
    if (!batchId) return;
    const statementIds = Array.from(selectedBankStatementIds);
    if (statementIds.length === 0) {
      showToast('Select at least one bank statement to reconcile against', { type: 'error' });
      return;
    }

    setIsReconcilingBank(true);
    setAutoBankResult(null);
    try {
      const response = await autoReconcileBank(batchId, {
        bank_statement_ids: statementIds,
        date_tolerance_days: dateToleranceDays,
        amount_tolerance_pct: amountTolerancePct,
        use_llm: useLlm,
      });
      setAutoBankResult(response.data);
      showToast(response.message || 'Bank reconciliation complete', { type: 'success' });
      await loadPageData();
      await loadRows();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reconcile settlement groups to bank', { type: 'error' });
    } finally {
      setIsReconcilingBank(false);
    }
  }

  async function handleClearBankLinks() {
    if (!batchId) return;
    if (!confirm('Reset all settlement-bank links for this reconciliation batch?')) return;

    setIsClearingBankLinks(true);
    try {
      const result = await deleteAllPaymentGatewayBankReconciliationLinks(batchId);
      showToast(`Deleted ${result.deleted_count || 0} bank link(s)`, { type: 'success' });
      await loadPageData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset bank links', { type: 'error' });
    } finally {
      setIsClearingBankLinks(false);
    }
  }

  async function handleRefresh() {
    await loadPageData();
    await loadRows();
    await loadBankLinks();
  }

  if (isLoading) {
    return (
      <AppLayout pageName="Platform & Merchant Reconciliation">
        <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
      </AppLayout>
    );
  }

  if (error || !detail) {
    return (
      <AppLayout pageName="Platform & Merchant Reconciliation">
        <div className="p-8 text-center">
          <p style={{ color: 'var(--error)' }}>{error || 'Reconciliation batch not found'}</p>
          <button
            onClick={() => router.push('/payment-gateways')}
            className="mt-4 rounded-lg border px-4 py-2"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Back to List
          </button>
        </div>
      </AppLayout>
    );
  }

  const { batch } = detail;
  const sourceLabel = providerLabel(batch.provider);
  const sourceStatusLabel = isPlatformProvider(batch.provider) ? 'Platform Status' : 'Merchant Status';
  const counterpartyLabel = isPlatformProvider(batch.provider) ? 'Store / Customer' : 'Customer / Merchant';
  const tallyCurrency = getCurrency(
    filteredMasterRows[0]?.transaction ||
    filteredMasterRows[0]?.settlement ||
    settlementScopedRows[0]?.transaction ||
    settlementScopedRows[0]?.settlement
  );

  return (
    <AppLayout pageName="Platform & Merchant Reconciliation">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <button
            onClick={() => router.push('/payment-gateways')}
            className="self-start rounded p-2 hover:bg-[var(--muted)]"
            style={{ color: 'var(--foreground)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              {sourceLabel} Batch #{batch.id}
            </h1>
            <p className="capitalize" style={{ color: 'var(--muted-foreground)' }}>
              {sourceLabel} reconciliation created {formatDate(batch.created_at)}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="rounded-lg border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Batch Summary</h2>
            <StatusBadge status={batch.status} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <SummaryItem label="Files" value={batch.file_count ?? detail.files.length} />
            <SummaryItem label="Transactions" value={batch.transaction_count ?? 0} />
            <SummaryItem label="Sales Transactions" value={batch.successful_transaction_count ?? 0} />
            <SummaryItem label="Settlement Rows" value={batch.settlement_row_count ?? 0} />
            <SummaryItem label="Matched" value={batch.matched_count ?? 0} />
            <SummaryItem label="Warnings" value={batch.warning_count ?? 0} />
            <SummaryItem label="Unmatched Transactions" value={batch.unmatched_transaction_count ?? 0} />
            <SummaryItem label="Unmatched Settlements" value={batch.unmatched_settlement_count ?? 0} />
            <SummaryItem label="Imported Transactions" value={batch.imported_transaction_count ?? 0} />
            <SummaryItem label="Skipped Duplicates" value={(batch.skipped_transaction_count ?? 0) + (batch.skipped_settlement_count ?? 0)} />
          </div>
        </div>

        {detail.files.length > 0 && (
          <div className="rounded-lg border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Imported Files</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {detail.files.map((file) => (
                <div key={file.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="font-medium" style={{ color: 'var(--foreground)' }}>{file.filename || `File #${file.id}`}</div>
                  <div className="mt-1 text-sm capitalize" style={{ color: 'var(--muted-foreground)' }}>
                    {file.file_type || '-'} | {file.status || '-'} | Imported {file.imported_count ?? 0}, skipped {file.skipped_count ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Reconcile Settlement To Bank</h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Match settlement payout groups to uploaded bank statement credit transactions.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearBankLinks}
                disabled={isClearingBankLinks || bankLinks.length === 0}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              >
                <Trash2 className="h-4 w-4" />
                {isClearingBankLinks ? 'Resetting...' : 'Reset Bank Links'}
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Bank Statements</label>
                <button
                  type="button"
                  onClick={() => setSelectedBankStatementIds(new Set(bankStatements.map((statement) => statement.id)))}
                  className="text-sm font-medium"
                  style={{ color: 'var(--primary)' }}
                >
                  Select all
                </button>
              </div>
              {bankStatements.length === 0 ? (
                <div className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                  Upload bank statements first, then return here to reconcile settlement payouts.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  {bankStatements.map((statement) => (
                    <label
                      key={statement.id}
                      className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBankStatementIds.has(statement.id)}
                        onChange={() => toggleBankStatement(statement.id)}
                      />
                      <span className="font-medium">#{statement.id}</span>
                      <span>{statement.bank_name || 'Bank'}{statement.account_number ? ` | ${statement.account_number}` : ''}</span>
                      <span className="ml-auto shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                        {formatDate(statement.statement_date_from)} - {formatDate(statement.statement_date_to)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Date Tolerance (days)</label>
                <input
                  type="number"
                  min={0}
                  value={dateToleranceDays}
                  onChange={(event) => setDateToleranceDays(Number(event.target.value))}
                  className="w-full rounded-lg border px-3 py-2"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Amount Tolerance (%)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={amountTolerancePct}
                  onChange={(event) => setAmountTolerancePct(Number(event.target.value))}
                  className="w-full rounded-lg border px-3 py-2"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <label className="flex items-end gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(event) => setUseLlm(event.target.checked)}
                  className="mb-3"
                />
                <span className="mb-2">Use AI for close candidates</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAutoReconcileBank}
                disabled={isReconcilingBank || selectedBankStatementIds.size === 0}
                className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Sparkles className="h-4 w-4" />
                {isReconcilingBank ? 'Reconciling...' : 'Run Bank Reconcile'}
              </button>
              {autoBankResult && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {autoBankResult.matched_count !== undefined && (
                    <span className="rounded px-2 py-1" style={{ background: 'var(--success)', color: 'white' }}>
                      {autoBankResult.matched_count} matched
                    </span>
                  )}
                  {autoBankResult.warning_count !== undefined && autoBankResult.warning_count > 0 && (
                    <span className="rounded px-2 py-1" style={{ background: 'var(--warning)', color: 'white' }}>
                      {autoBankResult.warning_count} warning
                    </span>
                  )}
                  {autoBankResult.skipped_count !== undefined && autoBankResult.skipped_count > 0 && (
                    <span className="rounded px-2 py-1" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                      {autoBankResult.skipped_count} skipped
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Master Merged Table</h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Transaction rows merged with settlement rows and bank reconciliation status.
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Showing {filteredMasterRows.length} of {settlementScopedRows.length} merged rows | {detail.settlementGroups.length} settlement groups
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Settlement Group</label>
                    <select
                      value={selectedSettlementId}
                      onChange={(event) => setSelectedSettlementId(event.target.value)}
                      className="w-full rounded-lg border px-3 py-2"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      <option value="all">All settlement groups</option>
                      {settlementGroupOptions.map((settlementId) => (
                        <option key={settlementId} value={settlementId}>{settlementId}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Displayed Rows</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{settlementTally.displayedCount}</div>
                    </div>
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Txn File Total</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{formatCurrency(settlementTally.transactionAmount, tallyCurrency)}</div>
                    </div>
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Settlement File Total</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{formatCurrency(settlementTally.settlementAmount, tallyCurrency)}</div>
                    </div>
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Difference</div>
                      <div className="text-sm font-semibold" style={{ color: Math.abs(settlementTally.difference) < 0.01 ? 'var(--success)' : 'var(--error)' }}>
                        {formatDifference(settlementTally.difference, tallyCurrency)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Settlement Match</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'matched', label: 'Matched' },
                        { value: 'warning', label: 'Warning' },
                        { value: 'unmatched', label: 'Unmatched' },
                      ].map((option) => {
                        const isActive = matchStatusFilters.includes(option.value as MatchStatusFilter);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMatchStatusFilters((prev) => toggleFilterValue(prev, option.value as MatchStatusFilter))}
                            className="rounded px-3 py-1.5 text-sm font-medium"
                            style={{
                              background: isActive ? 'var(--primary)' : 'var(--muted)',
                              color: isActive ? 'var(--primary-foreground)' : 'var(--foreground)',
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                      {matchStatusFilters.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMatchStatusFilters([])}
                          className="rounded px-3 py-1.5 text-sm font-medium"
                          style={{ background: 'var(--background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                        >
                          All
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Bank Match</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'matched', label: 'Matched' },
                        { value: 'warning', label: 'Warning' },
                        { value: 'unmatched', label: 'Unmatched' },
                      ].map((option) => {
                        const isActive = bankStatusFilters.includes(option.value as MatchStatusFilter);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBankStatusFilters((prev) => toggleFilterValue(prev, option.value as MatchStatusFilter))}
                            className="rounded px-3 py-1.5 text-sm font-medium"
                            style={{
                              background: isActive ? 'var(--primary)' : 'var(--muted)',
                              color: isActive ? 'var(--primary-foreground)' : 'var(--foreground)',
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                      {bankStatusFilters.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBankStatusFilters([])}
                          className="rounded px-3 py-1.5 text-sm font-medium"
                          style={{ background: 'var(--background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                        >
                          All
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>{sourceStatusLabel}</label>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as GatewayStatusFilter)}
                      className="w-full rounded-lg border px-3 py-2"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      <option value="Sales">Sales</option>
                      <option value="Failed">Failed</option>
                      <option value="all">All Statuses</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Search</label>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Transaction, settlement, customer, bank text"
                      className="w-full rounded-lg border px-3 py-2"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                  </div>
                </div>
                <details className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <summary className="cursor-pointer text-sm font-medium" style={{ color: 'var(--foreground)' }}>Columns</summary>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {[
                      ['matchStatus', 'Match'],
                      ['bankStatus', 'Bank'],
                      ['remark', 'Remark'],
                      ['transactionId', 'Transaction ID'],
                      ['merchantStatus', sourceStatusLabel],
                      ['customer', 'Customer'],
                      ['transactionDate', 'Date'],
                      ['settlementId', 'Settlement ID'],
                      ['transactionAmount', 'Txn Amount'],
                      ['settlementGross', 'Gross'],
                      ['settlementFee', 'Fee'],
                      ['settlementNet', 'Net'],
                      ['bankTransaction', 'Bank Txn'],
                      ['bankAmount', 'Bank Amount'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                        <input
                          type="checkbox"
                          checked={visibleColumns[key as MasterColumnKey]}
                          onChange={(event) => setVisibleColumns((prev) => ({ ...prev, [key]: event.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>

          {isRowsLoading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading merged rows...</div>
          ) : filteredMasterRows.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>No merged rows found for the selected filters.</div>
          ) : (
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0" style={{ background: 'var(--card)' }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {visibleColumns.matchStatus && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Match</th>}
                    {visibleColumns.bankStatus && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Bank</th>}
                    {visibleColumns.remark && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Remark</th>}
                    {visibleColumns.transactionId && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Transaction ID</th>}
                    {visibleColumns.merchantStatus && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>{sourceStatusLabel}</th>}
                    {visibleColumns.customer && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>{counterpartyLabel}</th>}
                    {visibleColumns.transactionDate && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Date</th>}
                    {visibleColumns.settlementId && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Settlement ID</th>}
                    {visibleColumns.transactionAmount && <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Txn Amount</th>}
                    {visibleColumns.settlementGross && <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Gross</th>}
                    {visibleColumns.settlementFee && <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Fee</th>}
                    {visibleColumns.settlementNet && <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Net</th>}
                    {visibleColumns.bankTransaction && <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Bank Transaction</th>}
                    {visibleColumns.bankAmount && <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Bank Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterRows.map((row) => {
                    const transaction = row.transaction;
                    const settlement = row.settlement;
                    const currency = getCurrency(transaction || settlement);
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background:
                            row.bankStatus === 'unmatched' ? 'rgba(220, 38, 38, 0.06)' :
                            row.matchStatus === 'warning' ? 'rgba(245, 158, 11, 0.10)' :
                            'rgba(22, 163, 74, 0.08)',
                        }}
                      >
                        {visibleColumns.matchStatus && <td className="px-4 py-3"><StatusBadge status={row.matchStatus} /></td>}
                        {visibleColumns.bankStatus && <td className="px-4 py-3"><StatusBadge status={row.bankStatus} /></td>}
                        {visibleColumns.remark && (
                          <td className="max-w-xs px-4 py-3 text-sm" style={{ color: row.remark === 'Matched' ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                            {row.remark}
                          </td>
                        )}
                        {visibleColumns.transactionId && <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{getTransactionId(transaction || settlement) || '-'}</td>}
                        {visibleColumns.merchantStatus && <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{getGatewayStatus(transaction)}</td>}
                        {visibleColumns.customer && <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{getCustomer(transaction || settlement) || '-'}</td>}
                        {visibleColumns.transactionDate && <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatDate(getTransactionDate(transaction))}</td>}
                        {visibleColumns.settlementId && <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{getSettlementId(transaction || settlement) || '-'}</td>}
                        {visibleColumns.transactionAmount && <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>{formatCurrency(getTransactionAmount(transaction), currency)}</td>}
                        {visibleColumns.settlementGross && <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>{formatCurrency(getSettlementGross(settlement), currency)}</td>}
                        {visibleColumns.settlementFee && <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>{formatCurrency(getSettlementFee(settlement), currency)}</td>}
                        {visibleColumns.settlementNet && <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>{formatCurrency(getSettlementNet(settlement), currency)}</td>}
                        {visibleColumns.bankTransaction && (
                          <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                            {row.bankLink ? (
                              <>
                                <div>#{textValue(row.bankLink as Record<string, unknown>, ['bank_transaction_id']) || '-'}</div>
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{bankTransactionDescription(row.bankLink) || '-'}</div>
                              </>
                            ) : '-'}
                          </td>
                        )}
                        {visibleColumns.bankAmount && <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>{formatCurrency(bankTransactionAmount(row.bankLink), currency)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
