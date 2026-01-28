'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Plus, ChevronDown } from "lucide-react";
import {
  listInvoices,
  deleteInvoice as deleteInvoiceApi,
  bulkDeleteInvoices,
  bulkVerifyInvoices,
  exportInvoicesCsv,
  downloadInvoicesZip,
  getSettings,
  pushInvoicesToBusinessCentral,
  type Invoice as ApiInvoice,
  type InvoiceStatus,
  type PushInvoicesResponse,
} from "@/services";

// Types
interface Vendor {
  id: number;
  name: string;
}

interface Remark {
  remarks: string;
}

// Extend backend Invoice type with extra optional fields used by UI
interface Invoice extends ApiInvoice {
  vendor_tax_id?: string;
  vendor_tin_number?: string;
  vendor_reg_no?: string;
  vendor_reg_no_new?: string;
  vendor_reg_no_old?: string;
  remarks?: string;
  created_by_name?: string;
  created_by_email?: string;
  // Duplicate detection fields (already in ApiInvoice, but explicitly included for clarity)
  is_duplicate?: boolean;
  original_invoice_id?: number | null;
  duplicate_group_id?: string | null;
  duplicate_count?: number | null;
}

interface VerifyStatus {
  status: 'ok' | 'mismatch' | 'unknown';
}

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

const settlementDocumentsListing = () => {
  const router = useRouter();
  const { t } = useLanguage();

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [verifyMap, setVerifyMap] = useState<Record<number, VerifyStatus>>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [advancedFiltersVisible, setAdvancedFiltersVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [orgRole, setOrgRole] = useState<string>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsHorizontalScroll, setNeedsHorizontalScroll] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportTemplate, setExportTemplate] = useState<'default' | 'xero_bill' | 'xero_sales' | 'autocount'>('default');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [bcConnectionId, setBcConnectionId] = useState<number | null>(null);
  const [isBusinessCentralEnabled, setIsBusinessCentralEnabled] = useState(false);
  const [isPushingToBC, setIsPushingToBC] = useState(false);
  const [showPushResultModal, setShowPushResultModal] = useState(false);
  const [pushResult, setPushResult] = useState<PushInvoicesResponse | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    search: '',
    remark: '',
    vendor_id: '',
    currency: '',
    status: [] as string[],
    min_amount: '',
    max_amount: '',
    page: 1,
    per_page: 20,
  });

  useEffect(() => {
    loadData();
    loadBusinessCentralConnection();
  }, [filters]);

  const loadBusinessCentralConnection = async () => {
    try {
      const settings = await getSettings();
      const bcIntegration = settings?.integrations?.business_central;
      const isEnabled = bcIntegration?.enabled ?? false;
      setIsBusinessCentralEnabled(isEnabled);
      
      const connections = bcIntegration?.connections || [];
      const activeConnection = connections.find((c) => c.is_active);
      if (activeConnection) {
        setBcConnectionId(activeConnection.id);
      }
    } catch (error) {
      console.error('Failed to load Business Central connection', error);
      setIsBusinessCentralEnabled(false);
    }
  };

  const handlePushToBusinessCentral = async () => {
    if (!bcConnectionId) {
      alert('Business Central connection not available. Please configure it in Settings.');
      return;
    }

    if (selectedInvoices.size === 0) {
      alert('Please select at least one invoice to push.');
      return;
    }

    setIsPushingToBC(true);
    try {
      const invoiceIds = Array.from(selectedInvoices);
      const result = await pushInvoicesToBusinessCentral({
        connection_id: bcConnectionId,
        invoice_ids: invoiceIds,
      });
      setPushResult(result);
      setShowPushResultModal(true);
      
      // Reload invoices to get updated BC status
      await loadData();
    } catch (error: any) {
      console.error('Failed to push invoices to Business Central', error);
      alert(error?.message || 'Failed to push invoices to Business Central');
    } finally {
      setIsPushingToBC(false);
    }
  };

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
  }, [invoices, filtersVisible]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listInvoices({
        page: filters.page,
        page_size: filters.per_page,
        search: filters.search || undefined,
        status:
          filters.status && filters.status.length > 0
            ? (filters.status.map((s) => s.toUpperCase()) as InvoiceStatus[])
            : undefined,
        vendor_id: filters.vendor_id ? Number(filters.vendor_id) : undefined,
        currency: filters.currency || undefined,
        min_amount: filters.min_amount ? Number(filters.min_amount) : undefined,
        max_amount: filters.max_amount ? Number(filters.max_amount) : undefined,
        tag: filters.remark || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to load invoices');
      }

      const rawData = (response as any).data;
      const data: ApiInvoice[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.invoices)
        ? rawData.invoices
        : [];
      // Sort by ID in descending order (largest to smallest)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setInvoices(sortedData as Invoice[]);

      // Use backend pagination metadata when available
      const total = typeof rawData?.total === 'number' ? rawData.total : data.length;
      const page = typeof rawData?.page === 'number' ? rawData.page : filters.page;
      const pageSize =
        typeof rawData?.page_size === 'number' ? rawData.page_size : filters.per_page;
      const totalPages =
        typeof rawData?.total_pages === 'number'
          ? rawData.total_pages
          : Math.max(1, Math.ceil(total / pageSize));

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

      // Vendor / remark filter options can be derived from current page for now
      const uniqueVendors: Record<number, string> = {};
      const remarkSet = new Set<string>();

      data.forEach((inv: ApiInvoice & { remarks?: string }) => {
        // @ts-expect-error vendor_id may not exist on all invoices
        if (inv.vendor_id && inv.vendor_name) {
          // @ts-expect-error vendor_id may not exist on type
          uniqueVendors[inv.vendor_id] = inv.vendor_name;
        }
        if (inv.remarks) {
          remarkSet.add(inv.remarks);
        }
      });

      setVendors(
        Object.entries(uniqueVendors).map(([id, name]) => ({
          id: Number(id),
          name,
        }))
      );

      setRemarks(Array.from(remarkSet).map((r) => ({ remarks: r })));

      // Verification indicators from API (if provided)
      const verificationMap: Record<number, VerifyStatus> = {};
      if (rawData?.verification && typeof rawData.verification === 'object') {
        Object.entries(rawData.verification as Record<string, any>).forEach(
          ([idStr, v]) => {
            const id = Number(idStr);
            if (!Number.isFinite(id)) return;
            const status =
              v?.status === 'ok' && v?.ok
                ? 'ok'
                : v?.status === 'mismatch' || v?.ok === false
                ? 'mismatch'
                : 'unknown';
            verificationMap[id] = { status };
          }
        );
      }
      setVerifyMap(verificationMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
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
      remark: '',
      vendor_id: '',
      currency: '',
      status: [],
      min_amount: '',
      max_amount: '',
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
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map((i) => i.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleInvoiceSelection = (id: number) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvoices(newSelected);
    setSelectAll(newSelected.size === invoices.length);
  };

  // Bulk actions
  const bulkDelete = async () => {
    if (selectedInvoices.size === 0) {
      alert(t.settlementDocuments.alerts.selectAtLeastOne);
      return;
    }
    const message = t.settlementDocuments.alerts.deleteConfirm.replace('{count}', selectedInvoices.size.toString());
    if (!confirm(message)) {
      return;
    }

    try {
      const ids = Array.from(selectedInvoices);
      const response = await bulkDeleteInvoices(ids);
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete invoices');
      }

      // Show success message
      alert(
        response.message || 
        `Successfully deleted ${response.data.deleted_count} invoice(s)`
      );

      // Clear selection and reload data
      setSelectedInvoices(new Set());
      setSelectAll(false);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to delete invoices'
      );
    }
  };

  const exportSelected = async (template: 'default' | 'xero_bill' | 'xero_sales' | 'autocount' = 'default') => {
    if (selectedInvoices.size === 0) {
      alert(t.settlementDocuments.alerts.exportSelectAtLeastOne);
      return;
    }
    try {
      setIsExporting(true);
      setIsExportDropdownOpen(false);
      const ids = Array.from(selectedInvoices);
      const { blob, filename } = await exportInvoicesCsv(ids, template);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date();
      const extension = template === 'autocount' ? '.xls' : '.csv';
      const fallbackName = `invoices_${timestamp
        .toISOString()
        .replace(/[-:]/g, '')
        .slice(0, 15)}${extension}`;

      link.download = filename || fallbackName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : t.settlementDocuments.alerts.exportSelectAtLeastOne
      );
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

  const downloadPdf = async () => {
    if (selectedInvoices.size === 0) {
      alert(t.settlementDocuments.alerts.exportSelectAtLeastOne);
      return;
    }
    try {
      setIsDownloading(true);
      const ids = Array.from(selectedInvoices);
      const { blob, filename } = await downloadInvoicesZip(ids);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date();
      const fallbackName = `invoices_${timestamp
        .toISOString()
        .replace(/[-:]/g, '')
        .slice(0, 15)}.zip`;

      link.download = filename || fallbackName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : t.settlementDocuments.alerts.exportSelectAtLeastOne
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteInvoice = async (invoiceId: number) => {
    const message = t.settlementDocuments.alerts.deleteConfirmSingle.replace('{id}', invoiceId.toString());
    if (!confirm(message)) {
      return;
    }

    try {
      const response = await deleteInvoiceApi(invoiceId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete invoice');
      }
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : t.settlementDocuments.alerts.deleteFailed
      );
    }
  };

  const recalcIndicators = () => {
    if (invoices.length === 0) {
      alert(t.settlementDocuments.alerts.exportSelectAtLeastOne);
      return;
    }

    const ids = invoices.map((inv) => inv.id);

    const run = async () => {
      try {
        setIsVerifying(true);
        const response = await bulkVerifyInvoices(ids);
        if (!response.success || !response.data?.verification) {
          throw new Error(response.message || 'Failed to verify invoices');
        }

        const verificationMap: Record<number, VerifyStatus> = {};
        Object.entries(response.data.verification).forEach(([idStr, v]) => {
          const id = Number(idStr);
          if (!Number.isFinite(id)) return;
          const status =
            v?.status === 'ok' && v?.ok
              ? 'ok'
              : v?.status === 'mismatch' || v?.ok === false
              ? 'mismatch'
              : 'unknown';
          verificationMap[id] = { status };
        });
        setVerifyMap(verificationMap);
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : t.settlementDocuments.alerts.verifyIndicators
        );
      } finally {
        setIsVerifying(false);
      }
    };

    void run();
  };

  return (
    <AppLayout pageName={t.settlementDocuments.title}>
      {/* Filter Panel */}
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] mb-6">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <h3 className="text-lg font-semibold m-0">🔍 {t.settlementDocuments.filters.title}</h3>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] transition-colors"
            onClick={toggleFilters}
          >
            <span className="mr-1">⚙️</span>
            {t.settlementDocuments.filters.toggleFilters}
          </button>
        </div>

        {filtersVisible && (
          <form onSubmit={applyFilters} className="p-6">
            {/* Basic Filters - Always Visible */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Date Range */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.dateRange}</label>
                  <div className="flex gap-2 max-w-md mb-3">
                    <input
                      type="date"
                      value={filters.start_date}
                      onChange={(e) => handleFilterChange('start_date', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder={t.settlementDocuments.filters.startDate}
                    />
                    <input
                      type="date"
                      value={filters.end_date}
                      onChange={(e) => handleFilterChange('end_date', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder={t.settlementDocuments.filters.endDate}
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
                  <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.search}</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder={t.settlementDocuments.filters.searchPlaceholder}
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
                {/* Remark/Tag */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.remarkTag}</label>
                  <select
                    value={filters.remark}
                    onChange={(e) => handleFilterChange('remark', e.target.value)}
                    className="w-full max-w-lg px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  >
                    <option value="">{t.settlementDocuments.filters.allTags}</option>
                    {remarks.map((remark, idx) => (
                      <option key={idx} value={remark.remarks}>
                        {remark.remarks}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vendor, Currency, Status, Amount */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vendor */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.vendor}</label>
                    <select
                      value={filters.vendor_id}
                      onChange={(e) => handleFilterChange('vendor_id', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">{t.settlementDocuments.filters.allVendors}</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.currency}</label>
                    <select
                      value={filters.currency}
                      onChange={(e) => handleFilterChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">{t.settlementDocuments.filters.allCurrencies}</option>
                      <option value="MYR">MYR</option>
                      <option value="USD">USD</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.status}</label>
                    <div className="space-y-2">
                      {['draft', 'validated', 'paid'].map((status) => (
                        <label key={status} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.status.includes(status)}
                            onChange={(e) => handleStatusChange(status, e.target.checked)}
                            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-sm capitalize">
                            {status === 'draft' ? t.dashboard.status.draft :
                             status === 'validated' ? t.dashboard.status.validated :
                             status === 'paid' ? (t.dashboard.status as any).paid || 'Paid' : status}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.settlementDocuments.filters.amountRange}</label>
                    <div className="flex gap-2 w-full">
                      <input
                        type="number"
                        value={filters.min_amount}
                        onChange={(e) => handleFilterChange('min_amount', e.target.value)}
                        placeholder={t.settlementDocuments.filters.min}
                        step="0.01"
                        className="w-1/2 min-w-0 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      />
                      <input
                        type="number"
                        value={filters.max_amount}
                        onChange={(e) => handleFilterChange('max_amount', e.target.value)}
                        placeholder={t.settlementDocuments.filters.max}
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
                {t.settlementDocuments.filters.clearAll}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
              >
                <span className="mr-2">🔍</span>
                {t.settlementDocuments.filters.applyFilters}
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
            <h2 className="text-2xl font-bold m-0">{t.settlementDocuments.title}</h2>
            {totalCount > 0 && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t.settlementDocuments.table.showing} {invoices.length} {t.settlementDocuments.table.of} {totalCount} {t.settlementDocuments.table.invoices}
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
              {t.settlementDocuments.newInvoice}
            </button>
            <button
              onClick={() => router.push('/documents/batch')}
              className="px-4 py-2 border border-[var(--border)] hover:text-white rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
            >
              <span className="mr-2">📁</span>
              {t.settlementDocuments.batchUpload}
            </button>
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                disabled={selectedInvoices.size === 0 || isExporting}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>📤</span>
                <span>
                  {isExporting
                    ? t.settlementDocuments.exportSelected
                    : `${t.settlementDocuments.exportSelected}${
                        selectedInvoices.size > 0 ? ` (${selectedInvoices.size})` : ''
                      }`}
                </span>
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
                    onClick={() => exportSelected('default')}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed first:rounded-t-lg"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <div className="font-medium">Default Format</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">Standard CSV export</div>
                  </button>
                  <button
                    onClick={() => exportSelected('xero_bill')}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-t"
                    style={{ 
                      color: 'var(--foreground)',
                      borderTopColor: 'var(--border)',
                    }}
                  >
                    <div className="font-medium">Xero Bill (Purchase)</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">For purchase invoices</div>
                  </button>
                  <button
                    onClick={() => exportSelected('xero_sales')}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-t"
                    style={{ 
                      color: 'var(--foreground)',
                      borderTopColor: 'var(--border)',
                    }}
                  >
                    <div className="font-medium">Xero Sales Invoice</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">For sales invoices</div>
                  </button>
                  <button
                    onClick={() => exportSelected('autocount')}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-t last:rounded-b-lg"
                    style={{ 
                      color: 'var(--foreground)',
                      borderTopColor: 'var(--border)',
                    }}
                  >
                    <div className="font-medium">AutoCount Format</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">CashBook .xls export</div>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={downloadPdf}
              disabled={selectedInvoices.size === 0 || isDownloading}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-2">📄</span>
              {isDownloading
                ? t.settlementDocuments.downloadPdf
                : `${t.settlementDocuments.downloadPdf}${
                    selectedInvoices.size > 0 ? ` (${selectedInvoices.size})` : ''
                  }`}
            </button>
            <button
              onClick={bulkDelete}
              disabled={selectedInvoices.size === 0}
              className="px-4 py-2 bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-2">🗑️</span>
              {t.settlementDocuments.deleteSelected} {selectedInvoices.size > 0 && `(${selectedInvoices.size})`}
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)] sticky left-[56px] z-10 bg-[var(--muted)] border-r border-[var(--border)]">{t.settlementDocuments.table.actions}</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.id}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.vendor}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.invoiceNo}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.date}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.currency}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.total}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.remarkTag}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Handwriting</th>
                {orgRole === 'admin' && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.uploadedBy}</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.verify}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.status}</th>
                {!needsHorizontalScroll && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.settlementDocuments.table.actions}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="group hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.has(invoice.id)}
                      onChange={() => toggleInvoiceSelection(invoice.id)}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                  </td>
                  {needsHorizontalScroll && (
                    <td className="px-4 py-3 sticky left-[56px] z-10 bg-white dark:bg-[var(--card)] border-r border-[var(--border)] group-hover:bg-[var(--hover-bg)] dark:group-hover:bg-[var(--hover-bg)]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/documents/${invoice.id}`)}
                          className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          {t.settlementDocuments.table.open}
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="px-3 py-1 text-sm bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors"
                        >
                          {t.settlementDocuments.table.delete}
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">{invoice.id}</td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{invoice.vendor_name || '-'}</div>
                      {(invoice.vendor_tax_id || invoice.vendor_tin_number || invoice.vendor_reg_no || invoice.vendor_reg_no_new || invoice.vendor_reg_no_old) && (
                        <div className="text-xs text-[var(--muted-foreground)] space-y-0.5 mt-1">
                          {invoice.vendor_tax_id && <div>{t.settlementDocuments.vendorInfo.sst}: {invoice.vendor_tax_id}</div>}
                          {invoice.vendor_tin_number && <div>{t.settlementDocuments.vendorInfo.tin}: {invoice.vendor_tin_number}</div>}
                          {invoice.vendor_reg_no_new && <div>{t.settlementDocuments.vendorInfo.regNew}: {invoice.vendor_reg_no_new}</div>}
                          {invoice.vendor_reg_no && !invoice.vendor_reg_no_new && <div>{t.settlementDocuments.vendorInfo.reg}: {invoice.vendor_reg_no}</div>}
                          {invoice.vendor_reg_no_old && <div>{t.settlementDocuments.vendorInfo.regOld}: {invoice.vendor_reg_no_old}</div>}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{invoice.invoice_no || '-'}</td>
                  <td className="px-4 py-3 text-sm">{invoice.invoice_date || '-'}</td>
                  <td className="px-4 py-3 text-sm">{invoice.currency || '-'}</td>
                  <td className="px-4 py-3 text-sm">{(invoice.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {invoice.remarks ? (
                      <span className="inline-block px-2 py-1 text-xs rounded-md bg-[var(--primary)] text-white">
                        {invoice.remarks}
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      if (invoice.is_handwritten === true) {
                        const clarity = invoice.handwriting_clarity;
                        if (clarity === 'unclear') {
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                              title="Handwritten invoice with unclear handwriting - needs review"
                            >
                              ✍️ Unclear
                            </span>
                          );
                        } else if (clarity === 'mixed') {
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                              title="Handwritten invoice with mixed clarity"
                            >
                              ✍️ Mixed
                            </span>
                          );
                        } else if (clarity === 'clear') {
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                              title="Handwritten invoice with clear handwriting"
                            >
                              ✍️ Clear
                            </span>
                          );
                        } else {
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              title="Handwritten invoice"
                            >
                              ✍️
                            </span>
                          );
                        }
                      } else if (invoice.is_handwritten === false) {
                        return (
                          <span className="text-[var(--muted-foreground)] text-xs">Printed</span>
                        );
                      } else {
                        return (
                          <span className="text-[var(--muted-foreground)]">-</span>
                        );
                      }
                    })()}
                  </td>
                  {orgRole === 'admin' && (
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium">{invoice.created_by_name || '-'}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{invoice.created_by_email || ''}</div>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {verifyMap[invoice.id] ? (
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-md ${
                          verifyMap[invoice.id].status === 'ok'
                            ? 'bg-[var(--success)] text-white'
                            : verifyMap[invoice.id].status === 'mismatch'
                            ? 'bg-[var(--warning)] text-[var(--warning-foreground)]'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {verifyMap[invoice.id].status === 'ok' ? t.settlementDocuments.verify.ok : verifyMap[invoice.id].status === 'mismatch' ? t.settlementDocuments.verify.check : t.settlementDocuments.verify.unknown}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      // Check bank reconciliation status first - it takes priority
                      if (invoice.bank_recon_status === 'reconciled') {
                        return (
                          <span 
                            className="px-2 py-1 text-xs rounded-md font-semibold text-white"
                            style={{
                              background: 'var(--success)',
                            }}
                          >
                            Reconciled
                          </span>
                        );
                      }

                      const rawStatus = invoice.status || 'draft';
                      const status = rawStatus.toLowerCase();
                      const isDraft = status === 'draft';
                      const isValidated = status === 'validated';
                      const isPosted = status === 'posted';
                      const isPaid = status === 'paid';

                      const label =
                        isDraft
                          ? t.dashboard.status.draft
                          : isValidated
                          ? t.dashboard.status.validated
                          : isPosted
                          ? t.dashboard.status.posted
                          : isPaid
                          ? (t.dashboard.status as any).paid ?? 'Paid'
                          : rawStatus;

                      const cls =
                        isPaid || isPosted
                          ? 'bg-[var(--success)] text-white'
                          : isValidated
                          ? 'bg-[var(--info)] text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';

                      if (invoice.is_duplicate) {
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                            title={
                              invoice.original_invoice_id
                                ? `Duplicate of invoice #${invoice.original_invoice_id}`
                                : invoice.duplicate_group_id
                                ? `Part of duplicate group ${invoice.duplicate_group_id}`
                                : 'Duplicate invoice'
                            }
                          >
                            Dup
                          </span>
                        );
                      }

                      return (
                        <span className={`inline-block px-2 py-1 text-xs rounded-md ${cls}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                  {!needsHorizontalScroll && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/documents/${invoice.id}`)}
                          className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          {t.settlementDocuments.table.open}
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="px-3 py-1 text-sm bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors"
                        >
                          {t.settlementDocuments.table.delete}
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
              {t.settlementDocuments.table.showing} {pagination.start} {t.settlementDocuments.table.to} {pagination.end} {t.settlementDocuments.table.of} {pagination.total} {t.settlementDocuments.table.invoices}
            </div>

            <div className="flex gap-2 items-center">
              {/* Previous */}
              {pagination.has_prev ? (
                <button
                  onClick={() => setFilters({ ...filters, page: pagination.prev_num! })}
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <span className="mr-1">←</span>
                  {t.settlementDocuments.pagination.previous}
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md opacity-50 cursor-not-allowed"
                >
                  <span className="mr-1">←</span>
                  {t.settlementDocuments.pagination.previous}
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
                  {t.settlementDocuments.pagination.next}
                  <span className="ml-1">→</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md opacity-50 cursor-not-allowed"
                >
                  {t.settlementDocuments.pagination.next}
                  <span className="ml-1">→</span>
                </button>
              )}
            </div>

            {/* Items per page */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--muted-foreground)]">{t.settlementDocuments.pagination.itemsPerPage}</label>
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

export default settlementDocumentsListing;

