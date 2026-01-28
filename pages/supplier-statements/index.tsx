'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Plus, Upload, Eye, Trash2, FileText } from "lucide-react";
import {
  listSupplierStatements,
  deleteSupplierStatement,
  getSupplierNames,
  uploadSupplierStatement,
  type SupplierStatement,
} from "@/services";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/lib/toast";

const SupplierStatementsList = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // State
  const [statements, setStatements] = useState<SupplierStatement[]>([]);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filters, setFilters] = useState({
    supplier_name: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    loadStatements();
    loadSupplierNames();
  }, [currentPage, filters]);

  const loadSupplierNames = async () => {
    try {
      const response = await getSupplierNames();
      setSupplierNames(response.data.supplier_names || []);
    } catch (err) {
      console.error('Failed to load supplier names', err);
    }
  };

  const loadStatements = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listSupplierStatements({
        page: currentPage,
        page_size: pageSize,
        supplier_name: filters.supplier_name || undefined,
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
      setError(err instanceof Error ? err.message : 'Failed to load supplier statements');
      showToast(err instanceof Error ? err.message : 'Failed to load supplier statements', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast(t.supplierStatements?.upload?.selectFile || 'Please select at least one file', { type: 'error' });
      return;
    }

    setIsUploading(true);

    try {
      // Upload files one by one (can be enhanced to support batch upload if API supports it)
      for (const file of selectedFiles) {
        await uploadSupplierStatement(file, false);
      }

      showToast(
        t.supplierStatements?.upload?.success || 'Supplier statement processed successfully',
        { type: 'success' }
      );
      
      setShowUploadModal(false);
      setSelectedFiles([]);
      await loadStatements();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload supplier statement';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.supplierStatements?.list?.deleteConfirm || 'Are you sure you want to delete this supplier statement?')) {
      return;
    }

    try {
      await deleteSupplierStatement(id);
      showToast(
        t.supplierStatements?.list?.deleteSuccess || 'Supplier statement deleted successfully',
        { type: 'success' }
      );
      await loadStatements();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete supplier statement';
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
    const currencyCode = currency || 'CNY';
    return `${currencyCode} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AppLayout pageName={t.supplierStatements?.title || 'Supplier Statements'}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              {t.supplierStatements?.title || 'Supplier Statements'}
            </h1>
            <p style={{ color: 'var(--muted-foreground)' }}>
              {t.supplierStatements?.description || 'Upload and manage supplier statements for payment tracking'}
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
            {t.supplierStatements?.upload?.button || 'Upload Statement'}
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            {t.supplierStatements?.list?.filters || 'Filters'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Supplier Name Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.supplierStatements?.list?.supplierName || 'Supplier Name'}
              </label>
              <select
                value={filters.supplier_name}
                onChange={(e) => setFilters({ ...filters, supplier_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">{t.supplierStatements?.list?.allSuppliers || 'All Suppliers'}</option>
                {supplierNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.supplierStatements?.list?.dateFrom || 'Date From'}
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
                {t.supplierStatements?.list?.dateTo || 'Date To'}
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
              {t.supplierStatements?.list?.noStatements || 'No supplier statements found. Upload your first statement to get started.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.supplierName || 'Supplier Name'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.period || 'Period'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.lineItems || 'Line Items'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.paidUnpaid || 'Paid / Unpaid'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.totalAmount || 'Total Amount'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.totalPayment || 'Total Payment'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.accountsReceivable || 'Accounts Payable'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.currency || 'Currency'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        Linked Invoices
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.list?.actions || 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((statement) => (
                      <tr
                        key={statement.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        className="hover:bg-[var(--muted)] cursor-pointer"
                        onClick={() => router.push(`/supplier-statements/${statement.id}`)}
                      >
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.supplier_name || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatDate(statement.statement_date_from)} - {formatDate(statement.statement_date_to)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.line_item_count || 0}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">
                              <span className="font-medium text-green-600 dark:text-green-400">
                                Paid: {statement.paid_count ?? 0}
                              </span>
                            </span>
                            <span className="text-sm">
                              <span className="font-medium text-red-600 dark:text-red-400">
                                Unpaid: {statement.unpaid_count ?? 0}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(statement.total_amount, statement.currency)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(statement.total_payment, statement.currency)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(statement.accounts_receivable, statement.currency)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.currency || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {statement.supplier_statement_links && statement.supplier_statement_links.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-[var(--primary)]">
                                {statement.supplier_statement_links.length} linked
                              </span>
                              <div className="text-xs text-[var(--muted-foreground)]">
                                {statement.supplier_statement_links.slice(0, 2).map((link, idx) => (
                                  <div key={link.id}>
                                    {link.invoice?.invoice_no || `Invoice #${link.invoice_id}`}
                                  </div>
                                ))}
                                {statement.supplier_statement_links.length > 2 && (
                                  <div>+{statement.supplier_statement_links.length - 2} more</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-[var(--muted-foreground)]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/supplier-statements/${statement.id}`)}
                              className="p-2 rounded hover:bg-[var(--muted)] transition-colors"
                              style={{ color: 'var(--foreground)' }}
                              title={t.supplierStatements?.list?.view || 'View'}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(statement.id)}
                              className="p-2 rounded hover:bg-red-500/10 transition-colors"
                              style={{ color: 'var(--error)' }}
                              title={t.supplierStatements?.list?.delete || 'Delete'}
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
                      {t.supplierStatements?.list?.showing || 'Showing'} {(currentPage - 1) * pageSize + 1} {t.supplierStatements?.list?.to || 'to'}{' '}
                      {Math.min(currentPage * pageSize, totalCount)} {t.supplierStatements?.list?.of || 'of'} {totalCount}
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
                          {t.supplierStatements?.list?.previous || 'Previous'}
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
                          {t.supplierStatements?.list?.next || 'Next'}
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
                  {t.supplierStatements?.upload?.title || 'Upload Supplier Statement'}
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
                {t.supplierStatements?.upload?.description || 'Upload PDF or image files of your supplier statements. The system will automatically extract line items. You can upload multiple files at once.'}
              </p>

              <FileUpload
                onFilesSelect={handleFilesSelect}
                multiple={true}
                accept=".pdf,.png,.jpg,.jpeg"
                required
                label={t.supplierStatements?.upload?.selectFiles || 'Select Files'}
                helpText={t.supplierStatements?.upload?.helpText || 'PDF files or images (PNG, JPG, JPEG). You can select multiple files.'}
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
                    ? (t.supplierStatements?.upload?.uploading || 'Uploading...')
                    : (t.supplierStatements?.upload?.uploadButton || `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Statement${selectedFiles.length !== 1 ? 's' : ''}`)
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default SupplierStatementsList;


