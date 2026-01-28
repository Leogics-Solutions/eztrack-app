'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Trash2, RefreshCw, Download, ChevronDown } from "lucide-react";
import {
  getBankStatement,
  getStatementTransactions,
  deleteBankStatement,
  getStatementLinks,
  reprocessTransactions,
  exportBankStatementsCsv,
  type BankStatement,
  type BankTransaction,
  type TransactionInvoiceLink,
} from "@/services";
import { useToast } from "@/lib/toast";
import { API_BASE_URL } from "@/services/config";

const BankStatementDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useLanguage();
  const { showToast } = useToast();

  // State
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [links, setLinks] = useState<TransactionInvoiceLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTemplate, setExportTemplate] = useState<'default' | 'xero_statement'>('default');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filters, setFilters] = useState({
    transaction_type: '' as '' | 'DEBIT' | 'CREDIT',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    if (id) {
      loadStatement();
      loadLinks();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadTransactions();
    }
  }, [id, currentPage, filters]);

  const loadStatement = async () => {
    if (!id || typeof id !== 'string') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getBankStatement(Number(id));
      setStatement(response.data);
      
      // Set file URL and content type for preview
      if (response.data?.file_url) {
        // Construct full URL if it's a relative path
        const url = response.data.file_url.startsWith('http') 
          ? response.data.file_url 
          : `${API_BASE_URL}${response.data.file_url}`;
        setFileUrl(url);
        // Determine content type from file extension
        const fileName = response.data.file_name || response.data.file_url;
        if (fileName?.toLowerCase().endsWith('.pdf')) {
          setFileContentType('application/pdf');
        } else if (fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          setFileContentType('image/' + fileName.split('.').pop()?.toLowerCase());
        } else {
          setFileContentType(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank statement');
      showToast(err instanceof Error ? err.message : 'Failed to load bank statement', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!id || typeof id !== 'string') return;

    setIsLoadingTransactions(true);
    try {
      const response = await getStatementTransactions(Number(id), {
        page: currentPage,
        page_size: pageSize,
        transaction_type: filters.transaction_type || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      });

      // API returns data as array directly, with pagination in separate object
      if (Array.isArray(response.data)) {
        setTransactions(response.data);
        setTotalTransactions(response.pagination?.total_items || response.data.length);
        setTotalPages(response.pagination?.total_pages || 1);
      } else {
        // Fallback for old structure (if any)
        setTransactions([]);
        setTotalTransactions(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const loadLinks = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      const response = await getStatementLinks(Number(id));
      setLinks(response.data || []);
    } catch (err) {
      console.error('Failed to load links', err);
    }
  };

  const handleDelete = async () => {
    if (!id || typeof id !== 'string') return;

    if (!confirm(t.bankStatements.detail.deleteConfirm || 'Are you sure you want to delete this bank statement?')) {
      return;
    }

    try {
      await deleteBankStatement(Number(id));
      showToast(
        t.bankStatements.detail.deleteSuccess || 'Bank statement deleted successfully',
        { type: 'success' }
      );
      router.push('/bank-statements');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bank statement';
      showToast(errorMessage, { type: 'error' });
    }
  };

  const handleReprocess = async () => {
    if (!id || typeof id !== 'string') return;

    if (!confirm(t.bankStatements.detail.reprocessConfirm || 'Reprocess transactions from stored file?')) {
      return;
    }

    try {
      await reprocessTransactions(Number(id));
      showToast(
        t.bankStatements.detail.reprocessSuccess || 'Transactions reprocessed successfully',
        { type: 'success' }
      );
      await loadStatement();
      await loadTransactions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reprocess transactions';
      showToast(errorMessage, { type: 'error' });
    }
  };

  const handleExport = async (template: 'default' | 'xero_statement' = 'default') => {
    if (!id || typeof id !== 'string') return;

    try {
      setIsExporting(true);
      setIsExportDropdownOpen(false);
      const { blob, filename } = await exportBankStatementsCsv([Number(id)], template);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date();
      const fallbackName = `bank_statement_${timestamp
        .toISOString()
        .replace(/[-:]/g, '')
        .slice(0, 15)}.csv`;

      link.download = filename || fallbackName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Bank statement exported successfully', { type: 'success' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export bank statement';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };

    if (isExportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportDropdownOpen]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number | null, currency?: string) => {
    if (amount === undefined || amount === null) return '-';
    const currencyCode = currency || statement?.currency || 'MYR';
    return `${currencyCode} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getLinkedInvoiceIds = () => {
    return new Set(links.map(link => link.invoice_id));
  };

  if (isLoading) {
    return (
      <AppLayout pageName={t.bankStatements.detail.title || 'Bank Statement Detail'}>
        <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
          {t.common.loading || 'Loading...'}
        </div>
      </AppLayout>
    );
  }

  if (error || !statement) {
    return (
      <AppLayout pageName={t.bankStatements.detail.title || 'Bank Statement Detail'}>
        <div className="p-8 text-center">
          <p style={{ color: 'var(--error)' }}>{error || 'Bank statement not found'}</p>
          <button
            onClick={() => router.push('/bank-statements')}
            className="mt-4 px-4 py-2 rounded-lg border"
            style={{
              background: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            {t.bankStatements.detail.backToList || 'Back to List'}
          </button>
        </div>
      </AppLayout>
    );
  }

  const linkedInvoiceIds = getLinkedInvoiceIds();

  return (
    <AppLayout pageName={t.bankStatements.detail.title || 'Bank Statement Detail'}>
      <div className="space-y-6">
        {/* Header (hidden menu bar) */}

        {/* Statement Summary */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {t.bankStatements.detail.summary || 'Statement Summary'}
            </h3>
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                disabled={isExporting}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {isExportDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg z-50"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <button
                    onClick={() => handleExport('default')}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed first:rounded-t-lg"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <div className="font-medium">Default Format</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">Standard CSV export</div>
                  </button>
                  <button
                    onClick={() => handleExport('xero_statement')}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-t last:rounded-b-lg"
                    style={{ 
                      color: 'var(--foreground)',
                      borderTopColor: 'var(--border)',
                    }}
                  >
                    <div className="font-medium">Xero Statement</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">Xero bank statement import format</div>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.detail.bankName || 'Bank Name'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {statement.bank_name || '-'}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.detail.accountNumber || 'Account Number'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {statement.account_number || '-'}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.detail.period || 'Period'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatDate(statement.statement_date_from)} - {formatDate(statement.statement_date_to)}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.detail.transactions || 'Transactions'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {statement.transaction_count || 0}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.detail.openingBalance || 'Opening Balance'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(statement.opening_balance, statement.currency)}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.detail.closingBalance || 'Closing Balance'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(statement.closing_balance, statement.currency)}
              </div>
            </div>
            {links.length > 0 && (
              <div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {t.bankStatements.detail.linkedInvoices || 'Linked Invoices'}
                </div>
                <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {links.length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File Preview */}
        {fileUrl && (
          <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              {t.bankStatements.detail.documentPreview || 'Document Preview'}
            </h3>
            <div className="w-full">
              {fileContentType?.startsWith('application/pdf') ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-[600px] border border-[var(--border)] rounded-md"
                  title="Bank Statement Preview"
                />
              ) : fileContentType?.startsWith('image/') ? (
                <img
                  src={fileUrl}
                  alt="Bank Statement"
                  className="w-full border border-[var(--border)] rounded-md"
                />
              ) : (
                <div className="text-sm text-[var(--muted-foreground)] p-4 border border-[var(--border)] rounded-md">
                  Preview not available for this file type.{' '}
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:underline"
                  >
                    Open file
                  </a>
                </div>
              )}
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-4 text-sm text-[var(--primary)] hover:underline"
              >
                {t.bankStatements.detail.openInNewTab || 'Open in new tab'}
              </a>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            {t.bankStatements.detail.filters || 'Filter Transactions'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.detail.transactionType || 'Transaction Type'}
              </label>
              <select
                value={filters.transaction_type}
                onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value as '' | 'DEBIT' | 'CREDIT' })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">{t.bankStatements.detail.allTypes || 'All Types'}</option>
                <option value="DEBIT">{t.bankStatements.detail.debit || 'Debit'}</option>
                <option value="CREDIT">{t.bankStatements.detail.credit || 'Credit'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.detail.dateFrom || 'Date From'}
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
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.detail.dateTo || 'Date To'}
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

        {/* Transactions Table */}
        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {t.bankStatements.detail.transactions || 'Transactions'}
            </h3>
          </div>
          {isLoadingTransactions ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t.common.loading || 'Loading...'}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t.bankStatements.detail.noTransactions || 'No transactions found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.detail.date || 'Date'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.detail.description || 'Description'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.detail.debit || 'Debit'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.detail.credit || 'Credit'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.detail.balance || 'Balance'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.bankStatements.detail.linked || 'Linked Invoice'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => {
                      const matchingLink = links.find(link => link.bank_transaction_id === transaction.id);
                      const isLinked = !!matchingLink;
                      const invoiceLink = transaction.invoice_link;
                      return (
                        <tr
                          key={transaction.id}
                          style={{ borderBottom: '1px solid var(--border)' }}
                          className={isLinked || invoiceLink ? 'bg-green-500/10' : ''}
                        >
                          <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                            {formatDate(transaction.transaction_date)}
                          </td>
                          <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                            {transaction.description}
                          </td>
                          <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(transaction.debit_amount, transaction.currency)}
                          </td>
                          <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(transaction.credit_amount, transaction.currency)}
                          </td>
                          <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(transaction.balance, transaction.currency)}
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {invoiceLink ? (
                              <div
                                className="flex flex-col gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  window.open(`/documents/${invoiceLink.invoice_id}`, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                <span className="text-xs px-2 py-1 rounded inline-block" style={{ background: 'var(--success)', color: 'white' }}>
                                  {invoiceLink.invoice_no}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {invoiceLink.vendor_name}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {formatCurrency(invoiceLink.invoice_total, invoiceLink.invoice_currency)}
                                </span>
                              </div>
                            ) : isLinked && matchingLink ? (
                              <span
                                className="text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity inline-block"
                                style={{ background: 'var(--success)', color: 'white' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  window.open(`/documents/${matchingLink.invoice_id}`, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                {t.bankStatements.detail.linked || 'Linked'}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.detail.showing || 'Showing'} {(currentPage - 1) * pageSize + 1} {t.bankStatements.detail.to || 'to'}{' '}
                      {Math.min(currentPage * pageSize, totalTransactions)} {t.bankStatements.detail.of || 'of'} {totalTransactions}
                    </div>
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
                        {t.bankStatements.detail.previous || 'Previous'}
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
                        {t.bankStatements.detail.next || 'Next'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default BankStatementDetail;


