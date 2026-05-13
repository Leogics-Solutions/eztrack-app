'use client';

import { AppLayout } from "@/components/layout";
import { FileUpload } from "@/components/FileUpload";
import { useOrganization } from "@/lib/OrganizationContext";
import { useToast } from "@/lib/toast";
import {
  deletePaymentGatewayReconciliation,
  listPaymentGatewayReconciliations,
  uploadPaymentGatewayReconciliation,
  type PaymentGatewayBatch,
  type PaymentGatewayProvider,
} from "@/services";
import { ChevronDown, Eye, Landmark, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const pageSize = 20;

const providerOptions: Array<{ value: PaymentGatewayProvider; label: string; description: string }> = [
  { value: 'payex', label: 'Payex', description: 'Merchant gateway transaction and settlement files.' },
  { value: 'foodpanda', label: 'Foodpanda', description: 'Foodpanda platform payout and order reports.' },
  { value: 'grab', label: 'Grab', description: 'Grab platform payout and transaction reports.' },
];

type ProviderFilter = 'all' | PaymentGatewayProvider;

function providerLabel(provider?: string) {
  return providerOptions.find((option) => option.value === provider)?.label || provider || '-';
}

function formatDate(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function pct(numerator?: number, denominator?: number) {
  if (!denominator) return '-';
  return `${Math.round(((numerator || 0) / denominator) * 100)}%`;
}

function StatusBadge({ status }: { status?: string }) {
  const color =
    status === 'ready' ? 'var(--success)' : status === 'failed' ? 'var(--error)' : 'var(--warning)';
  return (
    <span className="inline-flex rounded px-2 py-1 text-xs font-medium capitalize" style={{ background: color, color: 'white' }}>
      {status || 'unknown'}
    </span>
  );
}

export default function PaymentGatewayReconciliations() {
  const router = useRouter();
  const { showToast } = useToast();
  const { selectedOrganizationId } = useOrganization();

  const [batches, setBatches] = useState<PaymentGatewayBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedUploadProvider, setSelectedUploadProvider] = useState<PaymentGatewayProvider>('payex');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedOrganizationId, providerFilter]);

  async function loadBatches() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listPaymentGatewayReconciliations({
        page: currentPage,
        page_size: pageSize,
        provider: providerFilter,
      });
      setBatches(response.data || []);
      const totalItems = response.meta?.total_items || response.data?.length || 0;
      setTotalCount(totalItems);
      setTotalPages(response.meta?.total_pages || Math.max(1, Math.ceil(totalItems / pageSize)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load platform and merchant reconciliations';
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteBatch(batchId: number) {
    const confirmed = window.confirm(
      `Delete reconciliation batch #${batchId}? This will remove the uploaded batch and its related imported reconciliation data.`
    );
    if (!confirmed) return;

    setDeletingBatchId(batchId);
    try {
      const response = await deletePaymentGatewayReconciliation(batchId);
      showToast(response.message || 'Reconciliation batch deleted successfully', { type: 'success' });

      if (batches.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await loadBatches();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete reconciliation batch', { type: 'error' });
    } finally {
      setDeletingBatchId(null);
    }
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    setSelectedFiles([]);
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      showToast('Please select at least one transaction or settlement file', { type: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadPaymentGatewayReconciliation(selectedFiles, selectedUploadProvider);
      showToast(response.message || `${providerLabel(selectedUploadProvider)} files imported and reconciled successfully`, { type: 'success' });
      closeUploadModal();
      await loadBatches();
      if (response.data?.batch?.id) {
        router.push(`/payment-gateways/${response.data.batch.id}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload reconciliation files', { type: 'error' });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AppLayout pageName="Platform & Merchant Reconciliation">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              Platform & Merchant Reconciliation
            </h1>
            <p style={{ color: 'var(--muted-foreground)' }}>
              Upload platform or merchant transaction and settlement files, then reconcile payouts to bank statement transactions.
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-all"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Upload className="h-5 w-5" />
            Upload Files
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all' as ProviderFilter, label: 'All' },
            ...providerOptions.map((option) => ({ value: option.value as ProviderFilter, label: option.label })),
          ].map((option) => {
            const isActive = providerFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setProviderFilter(option.value);
                  setCurrentPage(1);
                }}
                className="rounded px-3 py-2 text-sm font-medium"
                style={{
                  background: isActive ? 'var(--primary)' : 'var(--muted)',
                  color: isActive ? 'var(--primary-foreground)' : 'var(--foreground)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {isLoading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>Loading...</div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center" style={{ color: 'var(--muted-foreground)' }}>
              <Landmark className="h-10 w-10" />
              <div>No reconciliation batches found. Upload transaction and settlement files to get started.</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Batch</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Provider</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Status</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Transactions</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Settlements</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Matched</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Warnings</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Unmatched</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Created</th>
                      <th className="px-4 py-3 text-left" style={{ color: 'var(--muted-foreground)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="cursor-pointer hover:bg-[var(--muted)]"
                        style={{ borderBottom: '1px solid var(--border)' }}
                        onClick={() => router.push(`/payment-gateways/${batch.id}`)}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>#{batch.id}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{providerLabel(batch.provider)}</td>
                        <td className="px-4 py-3"><StatusBadge status={batch.status} /></td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                          <div>{batch.successful_transaction_count ?? batch.transaction_count ?? 0} sales</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {batch.transaction_count ?? 0} imported rows
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{batch.settlement_row_count ?? 0}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                          {batch.matched_count ?? 0}
                          <span className="ml-2 rounded px-2 py-1 text-xs" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                            {pct(batch.matched_count, batch.successful_transaction_count)}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{batch.warning_count ?? 0}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                          {(batch.unmatched_transaction_count ?? 0) + (batch.unmatched_settlement_count ?? 0)}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatDate(batch.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/payment-gateways/${batch.id}`);
                              }}
                              className="rounded p-2 hover:bg-[var(--muted)]"
                              style={{ color: 'var(--foreground)' }}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteBatch(batch.id);
                              }}
                              disabled={deletingBatchId === batch.id}
                              className="rounded p-2 hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ color: 'var(--error)' }}
                              title="Delete"
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
                  <div style={{ color: 'var(--muted-foreground)' }}>
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Upload Reconciliation Files</h2>
                <button onClick={closeUploadModal} className="rounded p-2 hover:bg-[var(--muted)]" style={{ color: 'var(--foreground)' }}>
                  x
                </button>
              </div>
              <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Choose the source first, then select one or more transaction and settlement files. Excel files are parsed directly; PDF and image files are extracted by the backend.
              </p>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Provider</label>
                <div className="relative">
                  <select
                    value={selectedUploadProvider}
                    onChange={(event) => setSelectedUploadProvider(event.target.value as PaymentGatewayProvider)}
                    className="w-full appearance-none rounded-lg border px-3 py-2 pr-10 text-sm outline-none"
                    style={{
                      background: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'var(--muted-foreground)' }}
                  />
                </div>
              </div>

              <FileUpload
                onFilesSelect={setSelectedFiles}
                multiple
                accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                required
                label="Select Files"
                helpText="Excel, PDF, PNG, JPG, or JPEG files. Transaction and settlement files can be uploaded in any order."
                autoUpload={false}
              />

              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
                className="w-full rounded-lg px-4 py-2 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: selectedFiles.length > 0 && !isUploading ? 'var(--primary)' : 'var(--muted)',
                  color: selectedFiles.length > 0 && !isUploading ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length || ''} ${providerLabel(selectedUploadProvider)} File${selectedFiles.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
