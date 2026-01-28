'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Trash2, Download } from "lucide-react";
import {
  getSupplierStatement,
  getSupplierStatementLineItems,
  deleteSupplierStatement,
  type SupplierStatement,
  type SupplierStatementLineItem,
} from "@/services";
import { useToast } from "@/lib/toast";
import { API_BASE_URL } from "@/services/config";

const SupplierStatementDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useLanguage();
  const { showToast } = useToast();

  // State
  const [statement, setStatement] = useState<(SupplierStatement & { line_items?: SupplierStatementLineItem[] }) | null>(null);
  const [lineItems, setLineItems] = useState<SupplierStatementLineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLineItems, setIsLoadingLineItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLineItems, setTotalLineItems] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    is_paid: '' as '' | 'true' | 'false',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    if (id) {
      loadStatement();
    }
  }, [id]);

  useEffect(() => {
    if (id && statement) {
      // If statement has line_items and no filters/page changes, use them directly
      const hasFilters = filters.is_paid || filters.date_from || filters.date_to;
      if (statement.line_items && Array.isArray(statement.line_items) && !hasFilters && currentPage === 1) {
        // Use line items from statement response (includes links)
        setLineItems(statement.line_items);
        setTotalLineItems(statement.line_items.length);
        setTotalPages(1);
        setIsLoadingLineItems(false);
      } else if (hasFilters || currentPage > 1) {
        // Load separately only if filters or pagination is needed
        loadLineItems();
      }
    } else if (id) {
      // If statement not loaded yet, wait for it
      return;
    }
  }, [id, currentPage, filters, statement]);

  const loadStatement = async () => {
    if (!id || typeof id !== 'string') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getSupplierStatement(Number(id));
      setStatement(response.data);
      
      // If statement response includes line_items with links, use those instead of loading separately
      // This ensures links are available immediately
      if (response.data?.line_items && Array.isArray(response.data.line_items) && response.data.line_items.length > 0) {
        setLineItems(response.data.line_items);
        setTotalLineItems(response.data.line_items.length);
        setTotalPages(1);
      }
      
      // Set file URL and content type for preview
      // Backend now returns presigned S3 URLs directly in file_url
      if (response.data?.file_url) {
        // Use the URL directly if it's already absolute (presigned S3 URL or full URL)
        // Otherwise, construct full URL if it's a relative path (legacy support)
        const url = response.data.file_url.startsWith('http') 
          ? response.data.file_url 
          : `${API_BASE_URL}${response.data.file_url}`;
        setFileUrl(url);
        
        // Determine content type from file extension
        // Presigned URLs may include content-type in query params, but we'll use file extension as fallback
        const fileName = response.data.file_name || response.data.file_url.split('?')[0]; // Remove query params for extension check
        if (fileName?.toLowerCase().endsWith('.pdf')) {
          setFileContentType('application/pdf');
        } else if (fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          const ext = fileName.split('.').pop()?.toLowerCase();
          setFileContentType(`image/${ext === 'jpg' ? 'jpeg' : ext}`);
        } else {
          setFileContentType(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load supplier statement');
      showToast(err instanceof Error ? err.message : 'Failed to load supplier statement', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLineItems = async () => {
    if (!id || typeof id !== 'string') return;

    // If statement already has line_items with links, use those (unless filters are applied)
    const hasFilters = filters.is_paid || filters.date_from || filters.date_to;
    if (statement?.line_items && !hasFilters && currentPage === 1) {
      // Use line items from statement response which includes links
      setLineItems(statement.line_items);
      setTotalLineItems(statement.line_items.length);
      setTotalPages(1);
      return;
    }

    setIsLoadingLineItems(true);
    try {
      const response = await getSupplierStatementLineItems(Number(id), {
        page: currentPage,
        page_size: pageSize,
        is_paid: filters.is_paid ? filters.is_paid === 'true' : undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      });

      // API returns data as array directly, with pagination in separate object
      if (Array.isArray(response.data)) {
        // Merge links from statement line items if available
        let mergedLineItems = response.data;
        if (statement?.line_items) {
          const statementLineItemsMap = new Map(
            statement.line_items.map(item => [item.id, item])
          );
          mergedLineItems = response.data.map(item => {
            const statementItem = statementLineItemsMap.get(item.id);
            if (statementItem?.supplier_statement_links) {
              return {
                ...item,
                supplier_statement_links: statementItem.supplier_statement_links,
              };
            }
            return item;
          });
        }
        
        setLineItems(mergedLineItems);
        setTotalLineItems(response.meta?.total_items || response.data.length);
        setTotalPages(response.meta?.total_pages || 1);
      } else {
        // Fallback for old structure (if any)
        setLineItems([]);
        setTotalLineItems(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load line items', err);
    } finally {
      setIsLoadingLineItems(false);
    }
  };

  const handleDelete = async () => {
    if (!id || typeof id !== 'string') return;

    if (!confirm(t.supplierStatements?.detail?.deleteConfirm || 'Are you sure you want to delete this supplier statement?')) {
      return;
    }

    try {
      await deleteSupplierStatement(Number(id));
      showToast(
        t.supplierStatements?.detail?.deleteSuccess || 'Supplier statement deleted successfully',
        { type: 'success' }
      );
      router.push('/supplier-statements');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete supplier statement';
      showToast(errorMessage, { type: 'error' });
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number | null, currency?: string) => {
    if (amount === undefined || amount === null) return '-';
    const currencyCode = currency || statement?.currency || 'CNY';
    return `${currencyCode} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <AppLayout pageName={t.supplierStatements?.detail?.title || 'Supplier Statement Detail'}>
        <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
          {t.common.loading || 'Loading...'}
        </div>
      </AppLayout>
    );
  }

  if (error || !statement) {
    return (
      <AppLayout pageName={t.supplierStatements?.detail?.title || 'Supplier Statement Detail'}>
        <div className="p-8 text-center">
          <p style={{ color: 'var(--error)' }}>{error || 'Supplier statement not found'}</p>
          <button
            onClick={() => router.push('/supplier-statements')}
            className="mt-4 px-4 py-2 rounded-lg border"
            style={{
              background: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            {t.supplierStatements?.detail?.backToList || 'Back to List'}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageName={t.supplierStatements?.detail?.title || 'Supplier Statement Detail'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/supplier-statements')}
            className="p-2 rounded hover:bg-[var(--muted)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              {t.supplierStatements?.detail?.title || 'Supplier Statement'}
            </h1>
            <p style={{ color: 'var(--muted-foreground)' }}>
              {statement.supplier_name || 'Supplier Statement'}
            </p>
          </div>
        </div>

        {/* Statement Summary */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {t.supplierStatements?.detail?.summary || 'Statement Summary'}
            </h3>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-red-500/10 transition-colors"
              style={{
                borderColor: 'var(--error)',
                color: 'var(--error)',
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t.supplierStatements?.detail?.delete || 'Delete'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.supplierName || 'Supplier Name'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {statement.supplier_name || '-'}
              </div>
            </div>
            {statement.supplier_address && (
              <div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {t.supplierStatements?.detail?.supplierAddress || 'Supplier Address'}
                </div>
                <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {statement.supplier_address}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.period || 'Period'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatDate(statement.statement_date_from)} - {formatDate(statement.statement_date_to)}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.lineItems || 'Line Items'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {statement.line_item_count || 0}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.totalAmount || 'Total Amount'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(statement.total_amount, statement.currency)}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.totalPayment || 'Total Payment'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(statement.total_payment, statement.currency)}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.accountsReceivable || 'Accounts Payable'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(statement.accounts_receivable, statement.currency)}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t.supplierStatements?.detail?.currency || 'Currency'}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {statement.currency || '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Linked Invoices Section */}
        {statement.supplier_statement_links && statement.supplier_statement_links.length > 0 && (
          <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Linked Invoices ({statement.supplier_statement_links.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      Invoice No
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      Vendor
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      Match Type
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      Match Score
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      Linked Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statement.supplier_statement_links.map((link) => (
                    <tr key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4">
                        <a
                          href={`/documents/${link.invoice_id}`}
                          className="text-sm font-medium text-[var(--primary)] hover:underline"
                        >
                          {link.invoice?.invoice_no || `Invoice #${link.invoice_id}`}
                        </a>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                        {link.invoice?.vendor_name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="text-xs px-2 py-1 rounded inline-block capitalize"
                          style={{
                            background: link.match_type === 'auto' ? 'var(--info)' : 'var(--primary)',
                            color: 'white',
                          }}
                        >
                          {link.match_type}
                        </span>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                        {link.match_score ? (typeof link.match_score === 'number' ? link.match_score.toFixed(1) : Number(link.match_score).toFixed(1)) : '-'}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                        {link.created_at ? formatDate(link.created_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* File Preview */}
        {fileUrl && (
          <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              {t.supplierStatements?.detail?.documentPreview || 'Document Preview'}
            </h3>
            <div className="w-full">
              {fileContentType?.startsWith('application/pdf') ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-[600px] border border-[var(--border)] rounded-md"
                  title="Supplier Statement Preview"
                />
              ) : fileContentType?.startsWith('image/') ? (
                <img
                  src={fileUrl}
                  alt="Supplier Statement"
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
                {t.supplierStatements?.detail?.openInNewTab || 'Open in new tab'}
              </a>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            {t.supplierStatements?.detail?.filters || 'Filter Line Items'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.supplierStatements?.detail?.paymentStatus || 'Payment Status'}
              </label>
              <select
                value={filters.is_paid}
                onChange={(e) => setFilters({ ...filters, is_paid: e.target.value as '' | 'true' | 'false' })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">{t.supplierStatements?.detail?.allStatuses || 'All Statuses'}</option>
                <option value="true">{t.supplierStatements?.detail?.paid || 'Paid'}</option>
                <option value="false">{t.supplierStatements?.detail?.unpaid || 'Unpaid'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.supplierStatements?.detail?.dateFrom || 'Date From'}
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
                {t.supplierStatements?.detail?.dateTo || 'Date To'}
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

        {/* Line Items Table */}
        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {t.supplierStatements?.detail?.lineItems || 'Line Items'}
            </h3>
          </div>
          {isLoadingLineItems ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t.common.loading || 'Loading...'}
            </div>
          ) : lineItems.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t.supplierStatements?.detail?.noLineItems || 'No line items found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.transactionDate || 'Transaction Date'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.customerOrderNo || 'Customer Order No'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.billOfLadingNo || 'Bill of Lading No'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.amount || 'Amount'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.paymentAmount || 'Payment Amount'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.paymentStatus || 'Payment Status'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.paymentDate || 'Payment Date'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.electronicRelease || 'Electronic Release'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        {t.supplierStatements?.detail?.remarks || 'Remarks'}
                      </th>
                      <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                        Linked Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        className={item.is_paid ? 'bg-green-500/10' : ''}
                      >
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatDate(item.transaction_date)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {item.customer_order_no || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {item.bill_of_lading_no || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(item.amount, item.currency)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(item.payment_amount, item.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="text-xs px-2 py-1 rounded inline-block"
                            style={{
                              background: item.is_paid ? 'var(--success)' : 'var(--warning)',
                              color: 'white',
                            }}
                          >
                            {item.is_paid 
                              ? (t.supplierStatements?.detail?.paid || 'Paid')
                              : (t.supplierStatements?.detail?.unpaid || 'Unpaid')
                            }
                          </span>
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatDate(item.payment_date)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {item.is_released_electronically !== undefined
                            ? (item.is_released_electronically 
                                ? (t.supplierStatements?.detail?.yes || 'Yes')
                                : (t.supplierStatements?.detail?.no || 'No')
                              )
                            : '-'
                          }
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {item.remarks || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {(() => {
                            // Check for supplier_statement_links first (new structure), fallback to invoice_link (legacy)
                            const links = (item.supplier_statement_links && Array.isArray(item.supplier_statement_links) && item.supplier_statement_links.length > 0)
                              ? item.supplier_statement_links
                              : item.invoice_link
                                ? [item.invoice_link]
                                : [];
                            
                            if (links.length === 0) {
                              return <span className="text-sm text-[var(--muted-foreground)]">-</span>;
                            }
                            
                            return (
                              <div className="flex flex-col gap-2">
                                {links.map((link, idx) => (
                                  <div key={link.id || `link-${item.id}-${idx}`} className="flex flex-col gap-1">
                                    <a
                                      href={`/documents/${link.invoice_id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className="text-sm font-medium text-[var(--primary)] hover:underline"
                                    >
                                      {link.invoice?.invoice_no || `Invoice #${link.invoice_id}`}
                                    </a>
                                    <div className="text-xs text-[var(--muted-foreground)]">
                                      <span className="capitalize">{link.match_type || 'manual'}</span>
                                      {link.match_score && ` • Score: ${typeof link.match_score === 'number' ? link.match_score.toFixed(1) : Number(link.match_score).toFixed(1)}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ color: 'var(--muted-foreground)' }}>
                      {t.supplierStatements?.detail?.showing || 'Showing'} {(currentPage - 1) * pageSize + 1} {t.supplierStatements?.detail?.to || 'to'}{' '}
                      {Math.min(currentPage * pageSize, totalLineItems)} {t.supplierStatements?.detail?.of || 'of'} {totalLineItems}
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
                        {t.supplierStatements?.detail?.previous || 'Previous'}
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
                        {t.supplierStatements?.detail?.next || 'Next'}
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

export default SupplierStatementDetail;


