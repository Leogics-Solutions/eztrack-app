'use client';

import { FileUpload } from '@/components/FileUpload';
import { useToast } from '@/lib/toast';
import {
  autoReconcileBankLedger,
  deleteAllBankLedgerBankReconciliationLinks,
  deleteBankLedgerReconciliation,
  deleteBankLedgerBankReconciliationLink,
  getBankLedgerReconciliation,
  listBankLedgerBankReconciliationLinks,
  listBankLedgerReconciliations,
  listBankStatements,
  uploadBankLedger,
  type AutoReconcileBankLedgerResponse,
  type BankLedgerBankReconciliationLink,
  type BankLedgerBatch,
  type BankLedgerEntry,
  type BankStatement,
} from '@/services';
import { ArrowUpDown, Eye, FileSpreadsheet, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const pageSize = 20;
type LedgerEntryStatusFilter = 'all' | 'matched' | 'warning' | 'unmatched';
type LedgerEntrySortKey = 'status' | 'date' | 'contact' | 'reference' | 'amount';
type SortDirection = 'asc' | 'desc';

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function numberValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayValue<T>(record: Record<string, unknown>, keys: string[]): T[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
    const nested = objectValue(value);
    if (nested) {
      const nestedRows =
        nested.items ||
        nested.rows ||
        nested.entries ||
        nested.ledger_entries ||
        nested.links ||
        nested.bank_reconciliation_links;
      if (Array.isArray(nestedRows)) return nestedRows as T[];
    }
  }
  return [];
}

function formatCurrency(value: unknown, currency = 'MYR') {
  const amount = numberValue(value);
  if (amount === undefined) return '-';
  return `${currency} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ledgerEntryDate(entry: BankLedgerEntry) {
  return entry.entry_date || entry.transaction_date || entry.date || '';
}

function ledgerEntryAmount(entry: BankLedgerEntry) {
  const amount = numberValue(entry.amount);
  if (amount !== undefined) return amount;
  const credit = numberValue(entry.credit_amount);
  const debit = numberValue(entry.debit_amount);
  if (credit !== undefined && credit !== 0) return credit;
  return debit;
}

function ledgerEntryReference(entry: BankLedgerEntry) {
  return entry.reference_no || entry.reference_number || '';
}

function linkStatus(link?: BankLedgerBankReconciliationLink) {
  return link?.match_status || link?.status || 'linked';
}

function StatusBadge({ status }: { status?: string }) {
  const color =
    status === 'ready' || status === 'matched' || status === 'linked'
      ? 'var(--success)'
      : status === 'failed' || status === 'unmatched'
        ? 'var(--error)'
        : 'var(--warning)';

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

interface BankLedgerReconciliationPanelProps {
  selectedOrganizationId?: number | null;
}

export function BankLedgerReconciliationPanel({ selectedOrganizationId }: BankLedgerReconciliationPanelProps) {
  const { showToast } = useToast();

  const [batches, setBatches] = useState<BankLedgerBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BankLedgerBatch | null>(null);
  const [entries, setEntries] = useState<BankLedgerEntry[]>([]);
  const [links, setLinks] = useState<BankLedgerBankReconciliationLink[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [selectedBankStatementIds, setSelectedBankStatementIds] = useState<Set<number>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isClearingLinks, setIsClearingLinks] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dateToleranceDays, setDateToleranceDays] = useState(5);
  const [amountTolerancePct, setAmountTolerancePct] = useState(5);
  const [useLlm, setUseLlm] = useState(true);
  const [autoResult, setAutoResult] = useState<AutoReconcileBankLedgerResponse['data'] | null>(null);
  const [entryStatusFilter, setEntryStatusFilter] = useState<LedgerEntryStatusFilter>('all');
  const [entrySortKey, setEntrySortKey] = useState<LedgerEntrySortKey>('date');
  const [entrySortDirection, setEntrySortDirection] = useState<SortDirection>('asc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
    loadBankStatements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedOrganizationId]);

  useEffect(() => {
    if (selectedBatchId) {
      loadDetail(selectedBatchId);
    } else {
      setSelectedBatch(null);
      setEntries([]);
      setLinks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, selectedOrganizationId]);

  const linksByLedgerEntryId = useMemo(() => {
    const map = new Map<number, BankLedgerBankReconciliationLink>();
    links.forEach((link) => {
      if (link.ledger_entry_id) map.set(link.ledger_entry_id, link);
      link.ledger_entry_ids?.forEach((id) => map.set(id, link));
      link.ledger_entries?.forEach((entry) => map.set(entry.id, link));
      if (link.ledger_entry?.id) map.set(link.ledger_entry.id, link);
    });
    entries.forEach((entry) => {
      const link = entry.bank_link || entry.bank_reconciliation_link;
      if (link) map.set(entry.id, link);
    });
    return map;
  }, [entries, links]);

  const linkedEntryCount = useMemo(
    () => entries.filter((entry) => linksByLedgerEntryId.has(entry.id)).length,
    [entries, linksByLedgerEntryId]
  );

  const entryStatusCounts = useMemo(() => {
    return entries.reduce(
      (counts, entry) => {
        const link = linksByLedgerEntryId.get(entry.id);
        if (!link) {
          counts.unmatched += 1;
          return counts;
        }
        if (linkStatus(link) === 'warning') {
          counts.warning += 1;
        } else {
          counts.matched += 1;
        }
        return counts;
      },
      { all: entries.length, matched: 0, warning: 0, unmatched: 0 }
    );
  }, [entries, linksByLedgerEntryId]);

  const visibleEntries = useMemo(() => {
    const statusRank: Record<string, number> = {
      unmatched: 0,
      warning: 1,
      matched: 2,
      linked: 2,
    };

    return entries
      .filter((entry) => {
        const link = linksByLedgerEntryId.get(entry.id);
        if (entryStatusFilter === 'all') return true;
        if (entryStatusFilter === 'unmatched') return !link;
        if (!link) return false;
        const status = linkStatus(link);
        return entryStatusFilter === 'warning'
          ? status === 'warning'
          : status !== 'warning';
      })
      .sort((left, right) => {
        const leftLink = linksByLedgerEntryId.get(left.id);
        const rightLink = linksByLedgerEntryId.get(right.id);
        const direction = entrySortDirection === 'asc' ? 1 : -1;

        let comparison = 0;
        if (entrySortKey === 'status') {
          const leftStatus = leftLink ? linkStatus(leftLink) : 'unmatched';
          const rightStatus = rightLink ? linkStatus(rightLink) : 'unmatched';
          comparison = (statusRank[leftStatus] ?? 3) - (statusRank[rightStatus] ?? 3);
        } else if (entrySortKey === 'date') {
          comparison = ledgerEntryDate(left).localeCompare(ledgerEntryDate(right));
        } else if (entrySortKey === 'contact') {
          comparison = (left.contact || '').localeCompare(right.contact || '');
        } else if (entrySortKey === 'reference') {
          comparison = ledgerEntryReference(left).localeCompare(ledgerEntryReference(right));
        } else if (entrySortKey === 'amount') {
          comparison = (ledgerEntryAmount(left) || 0) - (ledgerEntryAmount(right) || 0);
        }

        if (comparison === 0) {
          comparison = left.id - right.id;
        }
        return comparison * direction;
      });
  }, [entries, entrySortDirection, entrySortKey, entryStatusFilter, linksByLedgerEntryId]);

  async function loadBatches() {
    setIsLoadingBatches(true);
    setError(null);
    try {
      const response = await listBankLedgerReconciliations({ page: currentPage, page_size: pageSize });
      const nextBatches = response.data || [];
      setBatches(nextBatches);
      const totalItems = response.meta?.total_items || nextBatches.length;
      setTotalCount(totalItems);
      setTotalPages(response.meta?.total_pages || Math.max(1, Math.ceil(totalItems / pageSize)));
      if (!selectedBatchId && nextBatches.length > 0) {
        setSelectedBatchId(nextBatches[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bank ledger reconciliations';
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setIsLoadingBatches(false);
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

  async function loadDetail(batchId: number) {
    setIsLoadingDetail(true);
    try {
      const [detailResponse, linksResponse] = await Promise.all([
        getBankLedgerReconciliation(batchId),
        listBankLedgerBankReconciliationLinks(batchId),
      ]);
      const responseRecord = detailResponse as unknown as Record<string, unknown>;
      const payload = objectValue(responseRecord.data) || responseRecord;
      const batchPayload = objectValue(payload.batch);
      const fallbackBatch = batches.find((batch) => batch.id === batchId);
      const detailBatch = (batchPayload || fallbackBatch || payload) as BankLedgerBatch;
      const detailEntries = arrayValue<BankLedgerEntry>(payload, [
        'ledger_entries',
        'entries',
        'imported_ledger_entries',
        'items',
        'rows',
      ]);
      const detailLinks = arrayValue<BankLedgerBankReconciliationLink>(payload, [
        'bank_reconciliation_links',
        'links',
      ]);

      setSelectedBatch(detailBatch);
      setEntries(detailEntries);
      setLinks(detailLinks.length > 0 ? detailLinks : linksResponse.data || []);
      setAutoResult(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load bank ledger detail', { type: 'error' });
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    setSelectedFiles([]);
  }

  async function handleUpload() {
    const file = selectedFiles[0];
    if (!file) {
      showToast('Please select a bank ledger export', { type: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadBankLedger(file);
      showToast(response.message || 'Bank ledger uploaded successfully', { type: 'success' });
      closeUploadModal();
      await loadBatches();
      const batchId = response.data?.batch?.id || response.data?.batch_id;
      if (batchId) setSelectedBatchId(Number(batchId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload bank ledger', { type: 'error' });
    } finally {
      setIsUploading(false);
    }
  }

  function toggleStatement(statementId: number) {
    setSelectedBankStatementIds((prev) => {
      const next = new Set(prev);
      if (next.has(statementId)) {
        next.delete(statementId);
      } else {
        next.add(statementId);
      }
      return next;
    });
  }

  async function handleAutoReconcile() {
    if (!selectedBatchId) return;
    const statementIds = Array.from(selectedBankStatementIds);
    if (statementIds.length === 0) {
      showToast('Select at least one bank statement to match against', { type: 'error' });
      return;
    }

    setIsReconciling(true);
    setAutoResult(null);
    try {
      const response = await autoReconcileBankLedger(selectedBatchId, {
        bank_statement_ids: statementIds,
        date_tolerance_days: dateToleranceDays,
        amount_tolerance_pct: amountTolerancePct,
        use_llm: useLlm,
      });
      setAutoResult(response.data);
      showToast(response.message || 'Bank ledger auto-reconciliation complete', { type: 'success' });
      await loadDetail(selectedBatchId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Auto-reconciliation failed', { type: 'error' });
    } finally {
      setIsReconciling(false);
    }
  }

  async function handleDeleteLink(linkId: number) {
    if (!confirm('Delete this bank ledger link?')) return;
    try {
      await deleteBankLedgerBankReconciliationLink(linkId);
      showToast('Bank ledger link deleted', { type: 'success' });
      if (selectedBatchId) await loadDetail(selectedBatchId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete bank ledger link', { type: 'error' });
    }
  }

  async function handleClearAllLinks() {
    if (!selectedBatchId) return;
    if (!confirm('Reset all bank transaction links for this ledger batch?')) return;

    setIsClearingLinks(true);
    try {
      const result = await deleteAllBankLedgerBankReconciliationLinks(selectedBatchId);
      showToast(`Deleted ${result.deleted_count || 0} bank link(s)`, { type: 'success' });
      await loadDetail(selectedBatchId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear bank ledger links', { type: 'error' });
    } finally {
      setIsClearingLinks(false);
    }
  }

  async function handleDeleteBatch(batchId: number) {
    if (!confirm(`Delete bank ledger batch #${batchId}? This will remove the uploaded ledger entries and bank reconciliation links for this batch.`)) return;

    setDeletingBatchId(batchId);
    try {
      await deleteBankLedgerReconciliation(batchId);
      showToast('Bank ledger deleted', { type: 'success' });

      const remainingBatches = batches.filter((batch) => batch.id !== batchId);
      if (selectedBatchId === batchId) {
        setSelectedBatchId(remainingBatches[0]?.id || null);
        setSelectedBatch(null);
        setEntries([]);
        setLinks([]);
      }

      if (batches.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await loadBatches();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete bank ledger', { type: 'error' });
    } finally {
      setDeletingBatchId(null);
    }
  }

  const selectedBatchForSummary = selectedBatch || batches.find((batch) => batch.id === selectedBatchId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border p-6 md:flex-row md:items-center md:justify-between" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Bank Ledger Reconciliation</h2>
          </div>
          <p className="max-w-3xl text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Upload Bukku or other accounting bank ledger exports, then confirm every ledger entry is represented by an uploaded bank statement transaction.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-all"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Upload className="h-5 w-5" />
          Upload Bank Ledger
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Ledger Batches</h3>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Imported accounting-system bank ledgers.</p>
            </div>
            <button
              type="button"
              onClick={loadBatches}
              className="rounded p-2 hover:bg-[var(--muted)]"
              style={{ color: 'var(--foreground)' }}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {isLoadingBatches ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading ledger batches...</div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center" style={{ color: 'var(--muted-foreground)' }}>
              <FileSpreadsheet className="h-10 w-10" />
              <div>No bank ledger batches found. Upload a Bukku ledger export to start checking completeness.</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Batch</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Account</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Entries</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Linked</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="cursor-pointer hover:bg-[var(--muted)]"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: selectedBatchId === batch.id ? 'var(--muted)' : undefined,
                        }}
                        onClick={() => setSelectedBatchId(batch.id)}
                      >
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                          <div className="font-medium">#{batch.id}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatDateTime(batch.created_at)}</div>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{batch.account_number || '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{batch.ledger_entry_count ?? batch.entry_count ?? '-'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{batch.linked_count ?? batch.matched_count ?? '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBatchId(batch.id);
                              }}
                              className="rounded p-2 hover:bg-[var(--muted)]"
                              style={{ color: 'var(--foreground)' }}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteBatch(batch.id);
                              }}
                              disabled={deletingBatchId === batch.id}
                              className="rounded p-2 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ color: 'var(--error)' }}
                              title="Delete ledger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalCount > 0 && (
                <div className="flex items-center justify-between border-t p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-lg border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          {!selectedBatchId ? (
            <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Select a ledger batch to review reconciliation status.
            </div>
          ) : isLoadingDetail ? (
            <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Loading ledger detail...
            </div>
          ) : (
            <>
              <div className="rounded-lg border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                      Ledger Batch #{selectedBatchId}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {selectedBatchForSummary?.filename || selectedBatchForSummary?.file_name || 'Bank ledger export'} | Account {selectedBatchForSummary?.account_number || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedBatchForSummary?.status && <StatusBadge status={selectedBatchForSummary.status} />}
                    <button
                      type="button"
                      onClick={() => selectedBatchId && loadDetail(selectedBatchId)}
                      className="rounded p-2 hover:bg-[var(--muted)]"
                      style={{ color: 'var(--foreground)' }}
                      title="Refresh detail"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <SummaryItem label="Ledger Entries" value={entries.length} />
                  <SummaryItem label="Linked Entries" value={linkedEntryCount} />
                  <SummaryItem label="Open Entries" value={Math.max(0, entries.length - linkedEntryCount)} />
                  <SummaryItem label="Bank Links" value={links.length} />
                </div>
              </div>

              <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Auto-Reconcile With Bank Statements</h3>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Match ledger entries to uploaded bank statement transactions. Select all candidate statements for the same account and period.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAllLinks}
                      disabled={isClearingLinks || links.length === 0}
                      className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isClearingLinks ? 'Resetting...' : 'Reset Links'}
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
                        Upload bank statements first, then return here to match the ledger.
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
                              onChange={() => toggleStatement(statement.id)}
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
                      onClick={handleAutoReconcile}
                      disabled={isReconciling || selectedBankStatementIds.size === 0}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                    >
                      <Sparkles className="h-4 w-4" />
                      {isReconciling ? 'Reconciling...' : 'Run Auto-Reconcile'}
                    </button>
                    {autoResult && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {autoResult.matched_count !== undefined && (
                          <span className="rounded px-2 py-1" style={{ background: 'var(--success)', color: 'white' }}>
                            {autoResult.matched_count} matched
                          </span>
                        )}
                        {autoResult.warning_count !== undefined && autoResult.warning_count > 0 && (
                          <span className="rounded px-2 py-1" style={{ background: 'var(--warning)', color: 'white' }}>
                            {autoResult.warning_count} warning
                          </span>
                        )}
                        {autoResult.skipped_count !== undefined && autoResult.skipped_count > 0 && (
                          <span className="rounded px-2 py-1" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                            {autoResult.skipped_count} skipped
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
                      <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Ledger Entries</h3>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Rows without a bank link are the items to investigate against bank statements.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="flex rounded-lg border p-1" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                        {[
                          { value: 'all', label: `All ${entryStatusCounts.all}` },
                          { value: 'matched', label: `Matched ${entryStatusCounts.matched}` },
                          { value: 'warning', label: `Warning ${entryStatusCounts.warning}` },
                          { value: 'unmatched', label: `Unmatched ${entryStatusCounts.unmatched}` },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEntryStatusFilter(option.value as LedgerEntryStatusFilter)}
                            className="rounded px-3 py-1.5 text-sm font-medium"
                            style={{
                              background: entryStatusFilter === option.value ? 'var(--primary)' : 'transparent',
                              color: entryStatusFilter === option.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                        <select
                          value={entrySortKey}
                          onChange={(event) => setEntrySortKey(event.target.value as LedgerEntrySortKey)}
                          className="rounded-lg border px-3 py-2 text-sm"
                          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          <option value="date">Date</option>
                          <option value="status">Status</option>
                          <option value="contact">Contact</option>
                          <option value="reference">Reference</option>
                          <option value="amount">Amount</option>
                        </select>
                        <select
                          value={entrySortDirection}
                          onChange={(event) => setEntrySortDirection(event.target.value as SortDirection)}
                          className="rounded-lg border px-3 py-2 text-sm"
                          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          <option value="asc">Asc</option>
                          <option value="desc">Desc</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                {entries.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>No ledger entries found for this batch.</div>
                ) : visibleEntries.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>No ledger entries match the selected filter.</div>
                ) : (
                  <div className="max-h-[520px] overflow-auto">
                    <table className="w-full">
                      <thead className="sticky top-0" style={{ background: 'var(--card)' }}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Bank Link</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Date</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Contact</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Description</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Reference No.</th>
                          <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.map((entry) => {
                          const link = linksByLedgerEntryId.get(entry.id);
                          return (
                            <tr
                              key={entry.id}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                background: link ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.06)',
                              }}
                            >
                              <td className="px-4 py-3">
                                {link ? <StatusBadge status={linkStatus(link)} /> : <StatusBadge status="unmatched" />}
                              </td>
                              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatDate(ledgerEntryDate(entry))}</td>
                              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{entry.contact || '-'}</td>
                              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{entry.description || '-'}</td>
                              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{ledgerEntryReference(entry) || '-'}</td>
                              <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>
                                {formatCurrency(ledgerEntryAmount(entry), entry.currency || 'MYR')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Bank Links</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Review or delete ledger-to-bank transaction links created by auto-reconciliation.</p>
                </div>
                {links.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>No bank links created yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Status</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Bank Transaction</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Ledger Entries</th>
                          <th className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>Bank Amount</th>
                          <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map((link) => (
                          <tr key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="px-4 py-3"><StatusBadge status={linkStatus(link)} /></td>
                            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                              <div>#{link.bank_transaction_id}</div>
                              {link.bank_transaction && (
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {formatDate(link.bank_transaction.transaction_date)} | {link.bank_transaction.description || '-'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                              {link.ledger_entry_ids?.length || link.ledger_entries?.length || (link.ledger_entry_id ? 1 : '-')}
                            </td>
                            <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>
                              {formatCurrency(
                                numberValue(link.bank_transaction?.credit_amount) ?? numberValue(link.bank_transaction?.debit_amount),
                                link.bank_transaction?.currency || 'MYR'
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleDeleteLink(link.id)}
                                className="rounded p-2 hover:bg-red-500/10"
                                style={{ color: 'var(--error)' }}
                                title="Delete link"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showUploadModal && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/50" onClick={closeUploadModal} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4" onClick={closeUploadModal}>
            <div
              className="my-auto w-full max-w-2xl rounded-lg border bg-[var(--card)] p-6"
              style={{ borderColor: 'var(--border)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Upload Bank Ledger</h2>
                <button onClick={closeUploadModal} className="rounded p-2 hover:bg-[var(--muted)]" style={{ color: 'var(--foreground)' }}>
                  x
                </button>
              </div>
              <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Upload a Bukku General Ledger spreadsheet or another bank ledger export. Excel files are parsed directly; PDFs, images, and unknown formats are extracted by the backend.
              </p>

              <FileUpload
                onFileSelect={(file) => setSelectedFiles(file ? [file] : [])}
                multiple={false}
                accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
                required
                label="Select Bank Ledger Export"
                helpText="Excel, CSV, PDF, PNG, JPG, or JPEG files."
                autoUpload={false}
              />

              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
                className="mt-4 w-full rounded-lg px-4 py-2 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: selectedFiles.length > 0 && !isUploading ? 'var(--primary)' : 'var(--muted)',
                  color: selectedFiles.length > 0 && !isUploading ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                {isUploading ? 'Uploading...' : 'Upload Bank Ledger'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
