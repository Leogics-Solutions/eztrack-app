'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Plus, Upload, Eye, Trash2, CreditCard } from "lucide-react";
import {
  listBankStatements,
  deleteBankStatement,
  getAccountNumbers,
  batchUploadBankStatements,
  getBankStatementJobStatus,
  type BankStatement,
  type BankStatementJobStatus,
  type BatchUploadBankStatementJob,
} from "@/services";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/lib/toast";

const BankStatementsList = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // State
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [accountNumbers, setAccountNumbers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentJobIds, setCurrentJobIds] = useState<string[]>([]);
  const [jobStatuses, setJobStatuses] = useState<Record<string, BankStatementJobStatus>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filters, setFilters] = useState({
    account_number: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    loadStatements();
    loadAccountNumbers();
  }, [currentPage, filters]);

  const loadAccountNumbers = async () => {
    try {
      const response = await getAccountNumbers();
      setAccountNumbers(response.data.account_numbers || []);
    } catch (err) {
      console.error('Failed to load account numbers', err);
    }
  };

  const loadStatements = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listBankStatements({
        page: currentPage,
        page_size: pageSize,
        account_number: filters.account_number || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      });

      if (response.data && Array.isArray(response.data)) {
        setStatements(response.data);
        
        // Parse pagination metadata - handle different response structures
        const totalItems = response.meta?.total_items || response.data.length;
        const totalPagesFromMeta = response.meta?.total_pages;
        
        // Calculate totalPages if not provided in meta
        const calculatedTotalPages = totalPagesFromMeta 
          ? totalPagesFromMeta 
          : Math.ceil(totalItems / pageSize);
        
        setTotalCount(totalItems);
        setTotalPages(calculatedTotalPages);
      } else {
        setStatements([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank statements');
      showToast(err instanceof Error ? err.message : 'Failed to load bank statements', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const pollJobStatuses = async (jobIds: string[]) => {
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    let attempts = 0;
    const completedJobs = new Set<string>();

    const poll = async (): Promise<void> => {
      const remainingJobs = jobIds.filter(id => !completedJobs.has(id));
      
      if (remainingJobs.length === 0) {
        // All jobs completed
        setShowUploadModal(false);
        setSelectedFiles([]);
        setCurrentJobIds([]);
        setJobStatuses({});
        setIsUploading(false);
        await loadStatements();
        return;
      }

      try {
        // Poll all remaining jobs
        const statusPromises = remainingJobs.map(async (jobId) => {
          try {
            const response = await getBankStatementJobStatus(jobId);
            const job = response.data;
            setJobStatuses(prev => ({ ...prev, [jobId]: job.status }));

            if (job.status === 'SUCCESS' || job.status === 'FAILED') {
              completedJobs.add(jobId);
              if (job.status === 'SUCCESS') {
                showToast(
                  `${t.bankStatements.upload.success || 'Bank statement processed successfully'}: ${job.original_filename}`,
                  { type: 'success' }
                );
              } else {
                const errorMsg = job.error_message || 'Bank statement processing failed';
                showToast(
                  `${t.bankStatements.upload.failed || 'Failed'}: ${job.original_filename} - ${errorMsg}`,
                  { type: 'error' }
                );
              }
            }
            return job.status;
          } catch (err) {
            console.error(`Failed to poll job ${jobId}`, err);
            return null;
          }
        });

        await Promise.all(statusPromises);

        attempts++;
        if (attempts >= maxAttempts) {
          showToast(
            t.bankStatements.upload.timeout || 'Processing is taking longer than expected. Please check back later.',
            { type: 'info' }
          );
          setShowUploadModal(false);
          setSelectedFiles([]);
          setCurrentJobIds([]);
          setJobStatuses({});
          setIsUploading(false);
          await loadStatements();
          return;
        }

        // Poll again after 5 seconds
        setTimeout(poll, 5000);
      } catch (err) {
        console.error('Failed to poll job statuses', err);
        attempts++;
        if (attempts >= maxAttempts) {
          showToast(
            t.bankStatements.upload.pollError || 'Failed to check processing status. Please refresh the page.',
            { type: 'error' }
          );
          setShowUploadModal(false);
          setSelectedFiles([]);
          setCurrentJobIds([]);
          setJobStatuses({});
          setIsUploading(false);
        } else {
          setTimeout(poll, 5000);
        }
      }
    };

    poll();
  };

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast(t.bankStatements.upload.selectFile || 'Please select at least one file', { type: 'error' });
      return;
    }

    setIsUploading(true);
    setJobStatuses({});
    setCurrentJobIds([]);

    try {
      const response = await batchUploadBankStatements(selectedFiles);
      
      const jobIds = response.data.jobs.map(job => job.job_id);
      setCurrentJobIds(jobIds);
      
      // Initialize all jobs as PENDING
      const initialStatuses: Record<string, BankStatementJobStatus> = {};
      jobIds.forEach(jobId => {
        initialStatuses[jobId] = 'PENDING';
      });
      setJobStatuses(initialStatuses);

      showToast(
        `${t.bankStatements.upload.batchAccepted || 'Upload accepted. Processing'} ${response.data.total_files} ${t.bankStatements.upload.file || 'file'}(s) ${t.bankStatements.upload.processing || 'in the background'}...`,
        { type: 'info' }
      );
      
      // Start polling for job statuses
      await pollJobStatuses(jobIds);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload bank statements';
      showToast(errorMessage, { type: 'error' });
      setIsUploading(false);
      setCurrentJobIds([]);
      setJobStatuses({});
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.bankStatements.list.deleteConfirm || 'Are you sure you want to delete this bank statement?')) {
      return;
    }

    try {
      await deleteBankStatement(id);
      showToast(
        t.bankStatements.list.deleteSuccess || 'Bank statement deleted successfully',
        { type: 'success' }
      );
      await loadStatements();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bank statement';
      showToast(errorMessage, { type: 'error' });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number, currency?: string) => {
    if (amount === undefined || amount === null) return '-';
    const currencyCode = currency || 'MYR';
    return `${currencyCode} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AppLayout pageName={t.bankStatements.title || 'Bank Statements'}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              {t.bankStatements.title || 'Bank Statements'}
            </h1>
            <p style={{ color: 'var(--muted-foreground)' }}>
              {t.bankStatements.description || 'Upload and manage bank statements for invoice reconciliation'}
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
            }}
          >
            <Upload className="h-5 w-5" />
            {t.bankStatements.upload.button || 'Upload Statement'}
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            {t.bankStatements.list.filters || 'Filters'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Account Number Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.list.accountNumber || 'Account Number'}
              </label>
              <select
                value={filters.account_number}
                onChange={(e) => setFilters({ ...filters, account_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">{t.bankStatements.list.allAccounts || 'All Accounts'}</option>
                {accountNumbers.map((acc) => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.list.dateFrom || 'Date From'}
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.list.dateTo || 'Date To'}
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg p-4 border border-red-500 bg-red-500/10 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Statements Table */}
        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {isLoading ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t.common.loading || 'Loading...'}
            </div>
          ) : statements.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t.bankStatements.list.noStatements || 'No bank statements found. Upload your first statement to get started.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.bankName || 'Bank'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.accountNumber || 'Account Number'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.period || 'Period'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.transactions || 'Transactions'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.currency || 'Currency'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.openingBalance || 'Opening Balance'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.closingBalance || 'Closing Balance'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.list.actions || 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((statement) => (
                      <tr
                        key={statement.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        className="hover:bg-[var(--muted)] cursor-pointer"
                        onClick={() => router.push(`/bank-statements/${statement.id}`)}
                      >
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.bank_name || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.account_number || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatDate(statement.statement_date_from)} - {formatDate(statement.statement_date_to)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.transaction_count || 0}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.currency || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(statement.opening_balance, statement.currency)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(statement.closing_balance, statement.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/bank-statements/${statement.id}`)}
                              className="p-2 rounded hover:bg-[var(--muted)] transition-colors"
                              style={{ color: 'var(--foreground)' }}
                              title={t.bankStatements.list.view || 'View'}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(statement.id)}
                              className="p-2 rounded hover:bg-red-500/10 transition-colors"
                              style={{ color: 'var(--error)' }}
                              title={t.bankStatements.list.delete || 'Delete'}
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

              {/* Pagination */}
              {totalCount > 0 && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.list.showing || 'Showing'} {(currentPage - 1) * pageSize + 1} {t.bankStatements.list.to || 'to'}{' '}
                      {Math.min(currentPage * pageSize, totalCount)} {t.bankStatements.list.of || 'of'} {totalCount}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: 'var(--background)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)',
                          }}
                        >
                          {t.bankStatements.list.previous || 'Previous'}
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: 'var(--background)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)',
                          }}
                        >
                          {t.bankStatements.list.next || 'Next'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/50"
            onClick={() => setShowUploadModal(false)}
          />
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="bg-[var(--card)] rounded-lg border max-w-2xl w-full p-6 my-auto"
              style={{ 
                borderColor: 'var(--border)',
                maxHeight: 'calc(100vh - 2rem)',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {t.bankStatements.upload.title || 'Upload Bank Statement'}
                </h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 rounded hover:bg-[var(--muted)]"
                  style={{ color: 'var(--foreground)' }}
                >
                  ✕
                </button>
              </div>
              <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.upload.description || 'Upload PDF or image files of your bank statements. The system will automatically extract transactions. You can upload multiple files at once.'}
              </p>

              <FileUpload
                onFilesSelect={handleFilesSelect}
                multiple={true}
                accept=".pdf,.png,.jpg,.jpeg"
                required
                label={t.bankStatements.upload.selectFiles || 'Select Files'}
                helpText={t.bankStatements.upload.helpText || 'PDF files or images (PNG, JPG, JPEG). You can select multiple files.'}
                autoUpload={false}
              />

              {/* Upload Button */}
              <div className="mt-4">
                <button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || isUploading}
                  className="w-full px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: selectedFiles.length > 0 && !isUploading ? 'var(--primary)' : 'var(--muted)',
                    color: selectedFiles.length > 0 && !isUploading ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {isUploading 
                    ? (t.bankStatements.upload.uploading || 'Uploading...')
                    : (t.bankStatements.upload.uploadButton || `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Statement${selectedFiles.length !== 1 ? 's' : ''}`)
                  }
                </button>
              </div>
              
              {isUploading && currentJobIds.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {t.bankStatements.upload.processing || 'Processing in background...'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {t.bankStatements.upload.processingFiles || 'Processing'} {currentJobIds.length} {t.bankStatements.upload.file || 'file'}(s)
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {currentJobIds.map((jobId, idx) => {
                      const status = jobStatuses[jobId] || 'PENDING';
                      return (
                        <div key={jobId} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {idx + 1}. {t.bankStatements.upload.jobId || 'Job'}: {jobId.substring(0, 8)}... - 
                          <span className="ml-1 font-medium capitalize" style={{ color: 'var(--foreground)' }}>
                            {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                    {t.bankStatements.upload.youCanClose || 'You can close this dialog. The page will refresh automatically when processing completes.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default BankStatementsList;

