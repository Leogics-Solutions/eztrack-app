'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Plus, ChevronDown } from "lucide-react";
import {
  listDocuments,
  deleteDocument as deleteDocumentService,
  bulkDeleteDocuments,
  type Document,
} from "@/services";


interface Pagination {
  page: number;
  prev_num?: number;
  next_num?: number;
  has_prev: boolean;
  has_next: boolean;
  start: number;
  end: number;
  total: number;
  iter_pages: () => (number | null)[];
}

const SupportingDocumentsListing = () => {
  const router = useRouter();
  const { t } = useLanguage();

  // State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [advancedFiltersVisible, setAdvancedFiltersVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [orgRole, setOrgRole] = useState<string>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsHorizontalScroll, setNeedsHorizontalScroll] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    search: '',
    direction: '' as '' | 'AP' | 'AR' | 'NEUTRAL',
    category: '',
    document_type_key: '',
    min_amount: '',
    max_amount: '',
    upload_status: '',
    status: [] as string[],
    page: 1,
    per_page: 20,
  });

  useEffect(() => {
    loadData();
  }, [filters]);


  // Check if table needs horizontal scrolling
  useEffect(() => {
    const checkScrollNeeded = () => {
      if (tableContainerRef.current) {
        const container = tableContainerRef.current;
        const table = container.querySelector('table');
        if (table) {
          // Add a small delay to ensure table is fully rendered
          setTimeout(() => {
            const needsScroll = table.scrollWidth > container.clientWidth;
            setNeedsHorizontalScroll(needsScroll);
          }, 100);
        }
      }
    };

    // Check on mount and when data changes
    checkScrollNeeded();

    // Check on window resize
    window.addEventListener('resize', checkScrollNeeded);
    
    // Use ResizeObserver for more accurate detection
    let resizeObserver: ResizeObserver | null = null;
    if (tableContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        // Debounce the check
        setTimeout(checkScrollNeeded, 50);
      });
      resizeObserver.observe(tableContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkScrollNeeded);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [documents, filtersVisible]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listDocuments({
        page: filters.page,
        page_size: filters.per_page,
        search: filters.search || undefined,
        direction: filters.direction || undefined,
        category: filters.category || undefined,
        document_type_key: filters.document_type_key || undefined,
        min_amount: filters.min_amount ? Number(filters.min_amount) : undefined,
        max_amount: filters.max_amount ? Number(filters.max_amount) : undefined,
        upload_status: filters.upload_status || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to load documents');
      }

      const rawData = response.data;
      const data: Document[] = rawData.documents || [];
      // Sort by ID in descending order (largest to smallest)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setDocuments(sortedData);

      // Use backend pagination metadata
      const total = rawData.total || 0;
      const page = rawData.page || filters.page;
      const pageSize = rawData.page_size || filters.per_page;
      const totalPages = rawData.total_pages || Math.max(1, Math.ceil(total / pageSize));

      setTotalCount(total);

      const hasPrev = page > 1;
      const hasNext = page < totalPages;
      const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const end = total === 0 ? 0 : Math.min(page * pageSize, total);

      const iter_pages = () => {
        const pages: (number | null)[] = [];
        const windowSize = 5;
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, startPage + windowSize - 1);
        if (endPage - startPage < windowSize - 1) {
          startPage = Math.max(1, endPage - windowSize + 1);
        }

        for (let p = startPage; p <= endPage; p++) {
          pages.push(p);
        }

        return pages;
      };

      setPagination({
        page,
        prev_num: hasPrev ? page - 1 : undefined,
        next_num: hasNext ? page + 1 : undefined,
        has_prev: hasPrev,
        has_next: hasNext,
        start,
        end,
        total,
        iter_pages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter functions
  const toggleFilters = () => {
    setFiltersVisible(!filtersVisible);
  };

  const toggleAdvancedFilters = () => {
    setAdvancedFiltersVisible(!advancedFiltersVisible);
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      search: '',
      direction: '',
      category: '',
      document_type_key: '',
      min_amount: '',
      max_amount: '',
      upload_status: '',
      status: [],
      page: 1,
      per_page: 20,
    });
  };

  const setDateRange = (preset: string) => {
    const now = new Date();
    let start: Date, end: Date;

    switch (preset) {
      case 'today':
        start = end = now;
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        end = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setFilters({
      ...filters,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
    });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const newStatus = checked
      ? [...filters.status, status]
      : filters.status.filter((s) => s !== status);
    setFilters({ ...filters, status: newStatus, page: 1 });
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const changePageSize = (size: number) => {
    setFilters({ ...filters, per_page: size, page: 1 });
  };

  // Selection functions
  const toggleAllSelection = () => {
    if (selectAll) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map((i) => i.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleDocumentSelection = (id: number) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocuments(newSelected);
    setSelectAll(newSelected.size === documents.length);
  };

  // Bulk actions
  const bulkDelete = async () => {
    if (selectedDocuments.size === 0) {
      alert(t.supportingDocuments.alerts.selectAtLeastOne);
      return;
    }
    const message = t.supportingDocuments.alerts.deleteConfirm.replace('{count}', selectedDocuments.size.toString());
    if (!confirm(message)) {
      return;
    }

    try {
      const ids = Array.from(selectedDocuments);
      const response = await bulkDeleteDocuments(ids);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete documents');
      }

      // Show success message
      alert(
        response.message || 
        `Successfully deleted ${response.data.deleted_count} document(s)`
      );

      // Clear selection and reload data
      setSelectedDocuments(new Set());
      setSelectAll(false);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to delete documents'
      );
    }
  };

  const deleteDocument = async (documentId: number) => {
    const message = t.supportingDocuments.alerts.deleteConfirmSingle.replace('{id}', documentId.toString());
    if (!confirm(message)) {
      return;
    }

    try {
      const response = await deleteDocumentService(documentId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete document');
      }
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : t.supportingDocuments.alerts.deleteFailed
      );
    }
  };

  return (
    <AppLayout pageName={t.supportingDocuments.title}>
      {/* Filter Panel */}
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] mb-6">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <h3 className="text-lg font-semibold m-0">🔍 {t.supportingDocuments.filters.title}</h3>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] transition-colors"
            onClick={toggleFilters}
          >
            <span className="mr-1">⚙️</span>
            {t.supportingDocuments.filters.toggleFilters}
          </button>
        </div>

        {filtersVisible && (
          <form onSubmit={applyFilters} className="p-6">
            {/* Basic Filters - Always Visible */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Date Range */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2">{t.supportingDocuments.filters.dateRange}</label>
                  <div className="flex gap-2 max-w-md mb-3">
                    <input
                      type="date"
                      value={filters.start_date}
                      onChange={(e) => handleFilterChange('start_date', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder={t.supportingDocuments.filters.startDate}
                    />
                    <input
                      type="date"
                      value={filters.end_date}
                      onChange={(e) => handleFilterChange('end_date', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder={t.supportingDocuments.filters.endDate}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['today', 'week', 'month', 'quarter', 'year'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDateRange(preset)}
                        className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                      >
                        {preset === 'today' && t.dashboard.filters.today}
                        {preset === 'week' && t.dashboard.filters.thisWeek}
                        {preset === 'month' && t.dashboard.filters.thisMonth}
                        {preset === 'quarter' && t.dashboard.filters.thisQuarter}
                        {preset === 'year' && t.dashboard.filters.thisYear}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t.supportingDocuments.filters.search}</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder={t.supportingDocuments.filters.searchPlaceholder}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={toggleAdvancedFilters}
                className="flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                <span>{advancedFiltersVisible ? '▼' : '▶'}</span>
                <span>{advancedFiltersVisible ? 'Hide Advanced Filters' : 'Show Advanced Filters'}</span>
              </button>
            </div>

            {/* Advanced Filters - Collapsible */}
            {advancedFiltersVisible && (
              <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-6">
                {/* Document Type, Direction, Category */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Document Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Document Type</label>
                    <select
                      value={filters.document_type_key}
                      onChange={(e) => handleFilterChange('document_type_key', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">All Types</option>
                      <option value="delivery_order">Delivery Order (DO)</option>
                      <option value="transfer_note">Transfer Note</option>
                      <option value="purchase_order">Purchase Order (PO)</option>
                    </select>
                  </div>

                  {/* Direction */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Direction</label>
                    <select
                      value={filters.direction}
                      onChange={(e) => handleFilterChange('direction', e.target.value as '' | 'AP' | 'AR' | 'NEUTRAL')}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">All Directions</option>
                      <option value="AP">AP (Accounts Payable)</option>
                      <option value="AR">AR (Accounts Receivable)</option>
                      <option value="NEUTRAL">Neutral</option>
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Category</label>
                    <select
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">All Categories</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="FULFILMENT_QUANTITY">Fulfilment Quantity</option>
                      <option value="SETTLEMENT_CONTROL">Settlement Control</option>
                    </select>
                  </div>
                </div>

                {/* Upload Status & Amount Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Upload Status */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Upload Status</label>
                    <select
                      value={filters.upload_status}
                      onChange={(e) => handleFilterChange('upload_status', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="pending_processing">Pending Processing</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.supportingDocuments.filters.amountRange}</label>
                    <div className="flex gap-2 w-full">
                      <input
                        type="number"
                        value={filters.min_amount}
                        onChange={(e) => handleFilterChange('min_amount', e.target.value)}
                        placeholder={t.supportingDocuments.filters.min}
                        step="0.01"
                        className="w-1/2 min-w-0 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      />
                      <input
                        type="number"
                        value={filters.max_amount}
                        onChange={(e) => handleFilterChange('max_amount', e.target.value)}
                        placeholder={t.supportingDocuments.filters.max}
                        step="0.01"
                        className="w-1/2 min-w-0 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
              >
                <span className="mr-2">🔄</span>
                {t.supportingDocuments.filters.clearAll}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
              >
                <span className="mr-2">🔍</span>
                {t.supportingDocuments.filters.applyFilters}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold m-0">{t.supportingDocuments.title}</h2>
            {totalCount > 0 && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Showing {documents.length} of {totalCount} documents
              </p>
            )}
            {error && (
              <p className="mt-1 text-sm text-red-500">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => router.push('/documents/new')}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center hidden"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.supportingDocuments.newInvoice}
            </button>
            <button
              onClick={() => router.push('/supporting-documents/batch')}
              className="px-4 py-2 border border-[var(--border)] hover:text-white rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
            >
              <span className="mr-2">📁</span>
              {t.supportingDocuments.batchUpload}
            </button>
            <button
              onClick={bulkDelete}
              disabled={selectedDocuments.size === 0}
              className="px-4 py-2 bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-2">🗑️</span>
              {t.supportingDocuments.deleteSelected} {selectedDocuments.size > 0 && `(${selectedDocuments.size})`}
            </button>
          </div>
        </div>

        {/* Table */}
        <div ref={tableContainerRef} className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--muted)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleAllSelection}
                    className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                </th>
                {needsHorizontalScroll && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)] sticky left-[56px] z-10 bg-[var(--muted)] border-r border-[var(--border)]">{t.supportingDocuments.table.actions}</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Document Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Reference Number</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Filename</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Duplicate</th>
                {!needsHorizontalScroll && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.supportingDocuments.table.actions}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {documents.map((doc) => (
                <tr key={doc.id} className="group hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.has(doc.id)}
                      onChange={() => toggleDocumentSelection(doc.id)}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                  </td>
                  {needsHorizontalScroll && (
                    <td className="px-4 py-3 sticky left-[56px] z-10 bg-white dark:bg-[var(--card)] border-r border-[var(--border)] group-hover:bg-[var(--hover-bg)] dark:group-hover:bg-[var(--hover-bg)]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/supporting-documents/${doc.id}`)}
                          className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          {t.supportingDocuments.table.open}
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="px-3 py-1 text-sm bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors"
                        >
                          {t.supportingDocuments.table.delete}
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">{doc.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{doc.document_type?.label || '-'}</div>
                    {doc.document_type?.description && (
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">{doc.document_type.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{doc.reference_number || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">{doc.category || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {doc.amount_total ? doc.amount_total.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="max-w-xs truncate" title={doc.filename || ''}>
                      {doc.filename || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {doc.upload_status ? (
                      <span className={`inline-block px-2 py-1 text-xs rounded-md ${
                        doc.upload_status === 'completed' ? 'bg-[var(--success)] text-white' :
                        doc.upload_status === 'processing' ? 'bg-[var(--info)] text-white' :
                        doc.upload_status === 'failed' ? 'bg-[var(--error)] text-white' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {doc.upload_status}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {doc.is_duplicate && doc.duplicate_count ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                        title={`Duplicate (${doc.duplicate_count} in group${doc.duplicate_group_id ? `: ${doc.duplicate_group_id}` : ''})`}
                      >
                        Dup ({doc.duplicate_count})
                      </span>
                    ) : doc.is_duplicate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                        Dup
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">-</span>
                    )}
                  </td>
                  {!needsHorizontalScroll && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/supporting-documents/${doc.id}`)}
                          className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          {t.supportingDocuments.table.open}
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="px-3 py-1 text-sm bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors"
                        >
                          {t.supportingDocuments.table.delete}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="p-4 border-t border-[var(--border)] flex flex-wrap justify-between items-center gap-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              Showing {pagination.start} to {pagination.end} of {pagination.total} documents
            </div>

            <div className="flex gap-2 items-center">
              {/* Previous */}
              {pagination.has_prev ? (
                <button
                  onClick={() => setFilters({ ...filters, page: pagination.prev_num! })}
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <span className="mr-1">←</span>
                  {t.supportingDocuments.pagination.previous}
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md opacity-50 cursor-not-allowed"
                >
                  <span className="mr-1">←</span>
                  {t.supportingDocuments.pagination.previous}
                </button>
              )}

              {/* Page Numbers */}
              <div className="flex gap-1">
                {pagination.iter_pages().map((page, idx) =>
                  page ? (
                    <button
                      key={idx}
                      onClick={() => setFilters({ ...filters, page })}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        page === pagination.page
                          ? 'bg-[var(--primary)] text-white'
                          : 'border border-[var(--border)] hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={idx} className="px-3 py-1.5 text-sm">
                      ...
                    </span>
                  )
                )}
              </div>

              {/* Next */}
              {pagination.has_next ? (
                <button
                  onClick={() => setFilters({ ...filters, page: pagination.next_num! })}
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                >
                  {t.supportingDocuments.pagination.next}
                  <span className="ml-1">→</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md opacity-50 cursor-not-allowed"
                >
                  {t.supportingDocuments.pagination.next}
                  <span className="ml-1">→</span>
                </button>
              )}
            </div>

            {/* Items per page */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--muted-foreground)]">{t.supportingDocuments.pagination.itemsPerPage}</label>
              <select
                value={filters.per_page}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="px-2 py-1 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        )}
      </div>

    </AppLayout>
  );
};

export default SupportingDocumentsListing;

