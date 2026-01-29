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
  matchInvoicesAcrossStatements,
  createLink,
  createLinksBulk,
  createSupplierStatementLink,
  createSupplierStatementLinksBulk,
  getStatementLinks,
  deleteLink,
  type Invoice as ApiInvoice,
  type InvoiceStatus,
  type PushInvoicesResponse,
  type MatchInvoicesAcrossStatementsResponse,
  type TransactionInvoiceLink,
} from "@/services";
import { useToast } from "@/lib/toast";

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
  // Status tracking fields
  missing_do?: boolean;
  missing_custom_form?: boolean;
  is_bank_reconciled?: boolean;
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

const DocumentsListing = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();

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
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [isReconRunning, setIsReconRunning] = useState(false);
  const [reconReport, setReconReport] = useState<MatchInvoicesAcrossStatementsResponse | null>(null);
  const [reconError, setReconError] = useState<string | null>(null);
  const [showReconReportModal, setShowReconReportModal] = useState(false);
  const [showCloseConfirmDialog, setShowCloseConfirmDialog] = useState(false);
  const [isCreatingLinks, setIsCreatingLinks] = useState(false);
  const [creatingLinkIds, setCreatingLinkIds] = useState<Set<string>>(new Set());
  const [isCreatingSupplierLinks, setIsCreatingSupplierLinks] = useState(false);
  const [creatingSupplierLinkIds, setCreatingSupplierLinkIds] = useState<Set<string>>(new Set());
  const [statementLinks, setStatementLinks] = useState<Map<number, TransactionInvoiceLink[]>>(new Map());
  const [reconOptions, setReconOptions] = useState({
    date_tolerance_days: 7,
    amount_tolerance_percentage: 2.0,
    currency_tolerance_percentage: 5.0,
    min_match_score: 60.0,
    exclude_linked: true,
    max_combo_size: 3,
    auto_create_links: false,
    auto_link_min_score: 85.0,
  });
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
    missing_do: false,
    missing_custom_form: false,
    not_bank_reconciled: false,
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
        missing_do: filters.missing_do || undefined,
        missing_custom_form: filters.missing_custom_form || undefined,
        not_bank_reconciled: filters.not_bank_reconciled || undefined,
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
      missing_do: false,
      missing_custom_form: false,
      not_bank_reconciled: false,
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
      alert(t.documents.alerts.selectAtLeastOne);
      return;
    }
    const message = t.documents.alerts.deleteConfirm.replace('{count}', selectedInvoices.size.toString());
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
      alert(t.documents.alerts.exportSelectAtLeastOne);
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
          : t.documents.alerts.exportSelectAtLeastOne
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
      alert(t.documents.alerts.exportSelectAtLeastOne);
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
          : t.documents.alerts.exportSelectAtLeastOne
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteInvoice = async (invoiceId: number) => {
    const message = t.documents.alerts.deleteConfirmSingle.replace('{id}', invoiceId.toString());
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
          : t.documents.alerts.deleteFailed
      );
    }
  };

  const recalcIndicators = () => {
    if (invoices.length === 0) {
      alert(t.documents.alerts.exportSelectAtLeastOne);
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
            : t.documents.alerts.verifyIndicators
        );
      } finally {
        setIsVerifying(false);
      }
    };

    void run();
  };

  const toNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatAmount = (value: number | string | null | undefined, currency?: string | null) => {
    const num = toNumber(value);
    if (num === null) return '-';
    const formatted = num.toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency ? `${currency} ${formatted}` : formatted;
  };

  const getConfidenceColor = (confidence?: string | null) => {
    switch (confidence) {
      case 'high':
        return 'bg-[var(--success)] text-white';
      case 'medium':
        return 'bg-[var(--warning)] text-[var(--warning-foreground)]';
      case 'low':
        return 'bg-[var(--error)] text-white';
      default:
        return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    }
  };

  const loadStatementLinks = async (statementId: number) => {
    try {
      const response = await getStatementLinks(statementId);
      if (response.success && response.data) {
        setStatementLinks((prev) => {
          const next = new Map(prev);
          next.set(statementId, response.data || []);
          return next;
        });
      }
    } catch (err) {
      console.error(`Failed to load links for statement ${statementId}:`, err);
    }
  };

  const loadAllStatementLinks = async () => {
    if (!reconReport) return;
    
    // Get unique statement IDs from the report
    const statementIds = new Set<number>();
    if (reconReport.statement_matches) {
      reconReport.statement_matches.forEach((statement) => {
        statementIds.add(statement.statement_id);
      });
    }

    // Load links for each statement
    await Promise.all(Array.from(statementIds).map((id) => loadStatementLinks(id)));
  };

  const handleBatchReconcile = async () => {
    if (selectedInvoices.size === 0) {
      alert('Please select at least one invoice to reconcile.');
      return;
    }

    setIsReconRunning(true);
    setReconError(null);

    try {
      const report = await matchInvoicesAcrossStatements(
        Array.from(selectedInvoices),
        reconOptions
      );
      setReconReport(report);
      setIsReconModalOpen(false);
      setShowReconReportModal(true);
      // Load links for all statements in the report
      await loadAllStatementLinks();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to run bank reconciliation';
      setReconError(message);
      alert(message);
    } finally {
      setIsReconRunning(false);
    }
  };

  const handleCloseReconReportModal = () => {
    setShowCloseConfirmDialog(true);
  };

  const confirmCloseReconReportModal = () => {
    setShowReconReportModal(false);
    setReconReport(null);
    setShowCloseConfirmDialog(false);
  };

  const cancelCloseReconReportModal = () => {
    setShowCloseConfirmDialog(false);
  };

  const getLinkForTransactionInvoice = (statementId: number, transactionId: number, invoiceId: number): TransactionInvoiceLink | undefined => {
    const links = statementLinks.get(statementId);
    if (!links) return undefined;
    return links.find(link => link.bank_transaction_id === transactionId && link.invoice_id === invoiceId);
  };

  const handleUnlink = async (linkId: number, statementId: number) => {
    try {
      await deleteLink(linkId);
      showToast('Link deleted successfully', { type: 'success' });
      // Reload links for this statement
      await loadStatementLinks(statementId);
      // Reload data to refresh reconciliation status
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete link';
      showToast(errorMessage, { type: 'error' });
    }
  };

  const handleCreateSingleLink = async (
    transactionId: number,
    invoiceId: number,
    allocatedAmount: number,
    matchScore: number,
    matchReason?: string
  ) => {
    const linkKey = `${transactionId}-${invoiceId}`;
    if (creatingLinkIds.has(linkKey)) return;

    setCreatingLinkIds((prev) => new Set(prev).add(linkKey));
    try {
      await createLink(transactionId, invoiceId, {
        match_type: 'manual',
        match_score: matchScore,
        allocated_amount: allocatedAmount,
        notes: matchReason || undefined,
      });
      showToast('Link created successfully', { type: 'success' });
      // Reload data to refresh reconciliation status
      await loadData();
      // Reload links - need to find which statement this transaction belongs to
      if (reconReport) {
        await loadAllStatementLinks();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create link';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setCreatingLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(linkKey);
        return next;
      });
    }
  };

  const handleCreateAllLinks = async () => {
    if (!reconReport) return;

    setIsCreatingLinks(true);
    const linksToCreate: Array<{
      bank_transaction_id: number;
      invoice_id: number;
      allocated_amount: number;
      match_score: number;
      match_type: 'manual';
      notes?: string;
    }> = [];

    // Collect links from statement matches
    reconReport.statement_matches.forEach((statement) => {
      statement.matches.forEach((transaction) => {
        transaction.matched_invoices.forEach((inv) => {
          linksToCreate.push({
            bank_transaction_id: transaction.transaction_id,
            invoice_id: inv.invoice_id,
            allocated_amount: toNumber(inv.allocated_amount) ?? toNumber(inv.converted_total) ?? toNumber(inv.invoice_total) ?? 0,
            match_score: toNumber(inv.match_score) ?? 0,
            match_type: 'manual',
            notes: inv.match_reason || undefined,
          });
        });
      });
    });

    // Collect links from invoice matches
    if (reconReport.invoice_matches) {
      reconReport.invoice_matches.forEach((invoice) => {
        invoice.matched_transactions.forEach((tx) => {
          linksToCreate.push({
            bank_transaction_id: tx.transaction_id,
            invoice_id: invoice.invoice_id,
            allocated_amount: toNumber(tx.allocated_amount) ?? toNumber(tx.transaction_amount) ?? 0,
            match_score: toNumber(tx.match_score) ?? 0,
            match_type: 'manual',
            notes: tx.match_reason || undefined,
          });
        });
      });
    }

    if (linksToCreate.length === 0) {
      showToast('No links to create', { type: 'info' });
      setIsCreatingLinks(false);
      return;
    }

    try {
      await createLinksBulk(linksToCreate);
      showToast(`Created ${linksToCreate.length} link(s) successfully`, { type: 'success' });
      // Reload data to refresh reconciliation status
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create links';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setIsCreatingLinks(false);
    }
  };

  const handleCreateSupplierStatementLink = async (
    lineItemId: number,
    invoiceId: number,
    matchScore: number,
    matchReason?: string
  ) => {
    const linkKey = `ss-${lineItemId}-${invoiceId}`;
    if (creatingSupplierLinkIds.has(linkKey)) return;

    setCreatingSupplierLinkIds((prev) => new Set(prev).add(linkKey));
    try {
      await createSupplierStatementLink(lineItemId, invoiceId, {
        match_type: 'manual',
        match_score: matchScore,
        notes: matchReason || undefined,
      });
      showToast('Supplier statement link created successfully', { type: 'success' });
      // Reload data to refresh reconciliation status
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create supplier statement link';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setCreatingSupplierLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(linkKey);
        return next;
      });
    }
  };

  const handleCreateAllSupplierStatementLinks = async () => {
    if (!reconReport) return;

    setIsCreatingSupplierLinks(true);
    const linksToCreate: Array<{
      supplier_statement_line_item_id: number;
      invoice_id: number;
      match_type: 'manual';
      match_score?: number;
      notes?: string;
    }> = [];

    // Collect supplier statement links from statement matches
    reconReport.statement_matches.forEach((statement) => {
      statement.matches.forEach((transaction) => {
        transaction.matched_invoices.forEach((inv) => {
          const supplierMatches = (inv as any).supplier_statement_matches;
          if (supplierMatches && Array.isArray(supplierMatches)) {
            supplierMatches.forEach((ssMatch: any) => {
              linksToCreate.push({
                supplier_statement_line_item_id: ssMatch.line_item_id,
                invoice_id: inv.invoice_id,
                match_type: 'manual',
                match_score: toNumber(ssMatch.match_score) ?? undefined,
                notes: ssMatch.match_reason || undefined,
              });
            });
          }
        });
      });
    });

    // Collect supplier statement links from invoice matches (this is where the data actually is!)
    if (reconReport.invoice_matches) {
      reconReport.invoice_matches.forEach((invoice) => {
        const invoiceAny = invoice as any;
        const supplierMatches = invoiceAny.supplier_statement_matches;
        if (supplierMatches && Array.isArray(supplierMatches) && supplierMatches.length > 0) {
          supplierMatches.forEach((ssMatch: any) => {
            linksToCreate.push({
              supplier_statement_line_item_id: ssMatch.line_item_id,
              invoice_id: invoice.invoice_id,
              match_type: 'manual',
              match_score: toNumber(ssMatch.match_score) ?? undefined,
              notes: ssMatch.match_reason || undefined,
            });
          });
        }
      });
    }

    if (linksToCreate.length === 0) {
      showToast('No supplier statement links to create', { type: 'info' });
      setIsCreatingSupplierLinks(false);
      return;
    }

    try {
      await createSupplierStatementLinksBulk(linksToCreate);
      showToast(`Created ${linksToCreate.length} supplier statement link(s) successfully`, { type: 'success' });
      // Reload data to refresh reconciliation status
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create supplier statement links';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setIsCreatingSupplierLinks(false);
    }
  };

  return (
    <AppLayout pageName={t.documents.title}>
      {isReconModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-3xl mx-4 rounded-lg shadow-lg bg-white dark:bg-[var(--card)] border border-[var(--border)]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold m-0">Batch Bank Reconciliation</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Selected invoices: {selectedInvoices.size}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReconModalOpen(false)}
                className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--hover-bg)] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              {reconError && (
                <div className="text-sm text-red-500">
                  {reconError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date Tolerance (days)</label>
                  <input
                    type="number"
                    value={reconOptions.date_tolerance_days}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, date_tolerance_days: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount Tolerance (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={reconOptions.amount_tolerance_percentage}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, amount_tolerance_percentage: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Currency Tolerance (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={reconOptions.currency_tolerance_percentage}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, currency_tolerance_percentage: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Min Match Score</label>
                  <input
                    type="number"
                    step="0.1"
                    value={reconOptions.min_match_score}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, min_match_score: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Max Combo Size</label>
                  <input
                    type="number"
                    value={reconOptions.max_combo_size}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, max_combo_size: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Auto Link Min Score</label>
                  <input
                    type="number"
                    step="0.1"
                    value={reconOptions.auto_link_min_score}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, auto_link_min_score: Number(e.target.value) })
                    }
                    disabled={!reconOptions.auto_create_links}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reconOptions.exclude_linked}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, exclude_linked: e.target.checked })
                    }
                    className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm">Exclude already linked invoices</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reconOptions.auto_create_links}
                    onChange={(e) =>
                      setReconOptions({ ...reconOptions, auto_create_links: e.target.checked })
                    }
                    className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm">Auto-create links for high-confidence matches</span>
                </label>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReconModalOpen(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchReconcile}
                disabled={isReconRunning}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReconRunning ? 'Running...' : 'Run Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Filter Panel */}
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] mb-6">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <h3 className="text-lg font-semibold m-0">🔍 {t.documents.filters.title}</h3>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] transition-colors"
            onClick={toggleFilters}
          >
            <span className="mr-1">⚙️</span>
            {t.documents.filters.toggleFilters}
          </button>
        </div>

        {filtersVisible && (
          <form onSubmit={applyFilters} className="p-6">
            {/* Basic Filters - Always Visible */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Date Range */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2">{t.documents.filters.dateRange}</label>
                  <div className="flex gap-2 max-w-md mb-3">
                    <input
                      type="date"
                      value={filters.start_date}
                      onChange={(e) => handleFilterChange('start_date', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder={t.documents.filters.startDate}
                    />
                    <input
                      type="date"
                      value={filters.end_date}
                      onChange={(e) => handleFilterChange('end_date', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder={t.documents.filters.endDate}
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
                  <label className="block text-sm font-medium mb-2">{t.documents.filters.search}</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder={t.documents.filters.searchPlaceholder}
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
                  <label className="block text-sm font-medium mb-2">{t.documents.filters.remarkTag}</label>
                  <select
                    value={filters.remark}
                    onChange={(e) => handleFilterChange('remark', e.target.value)}
                    className="w-full max-w-lg px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  >
                    <option value="">{t.documents.filters.allTags}</option>
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
                    <label className="block text-sm font-medium mb-2">{t.documents.filters.vendor}</label>
                    <select
                      value={filters.vendor_id}
                      onChange={(e) => handleFilterChange('vendor_id', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">{t.documents.filters.allVendors}</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.documents.filters.currency}</label>
                    <select
                      value={filters.currency}
                      onChange={(e) => handleFilterChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    >
                      <option value="">{t.documents.filters.allCurrencies}</option>
                      <option value="MYR">MYR</option>
                      <option value="USD">USD</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>

                  {/* Status and Status Checks */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Status */}
                    <div>
                      <label className="block text-sm font-medium mb-2">{t.documents.filters.status}</label>
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

                    {/* Status Checks */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Status Checks</label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.missing_do}
                            onChange={(e) => handleFilterChange('missing_do', e.target.checked)}
                            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-sm">Missing DO</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.missing_custom_form}
                            onChange={(e) => handleFilterChange('missing_custom_form', e.target.checked)}
                            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-sm">Missing Form</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.not_bank_reconciled}
                            onChange={(e) => handleFilterChange('not_bank_reconciled', e.target.checked)}
                            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-sm">Not Reconciled</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t.documents.filters.amountRange}</label>
                    <div className="flex gap-2 w-full">
                      <input
                        type="number"
                        value={filters.min_amount}
                        onChange={(e) => handleFilterChange('min_amount', e.target.value)}
                        placeholder={t.documents.filters.min}
                        step="0.01"
                        className="w-1/2 min-w-0 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      />
                      <input
                        type="number"
                        value={filters.max_amount}
                        onChange={(e) => handleFilterChange('max_amount', e.target.value)}
                        placeholder={t.documents.filters.max}
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
                {t.documents.filters.clearAll}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
              >
                <span className="mr-2">🔍</span>
                {t.documents.filters.applyFilters}
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
            <h2 className="text-2xl font-bold m-0">{t.documents.title}</h2>
            {totalCount > 0 && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t.documents.table.showing} {invoices.length} {t.documents.table.of} {totalCount} {t.documents.table.invoices}
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
              {t.documents.newInvoice}
            </button>
            <button
              onClick={() => router.push('/documents/batch')}
              className="px-4 py-2 border border-[var(--border)] hover:text-white rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
            >
              <span className="mr-2">📁</span>
              {t.documents.batchUpload}
            </button>
            <button
              onClick={() => setIsReconModalOpen(true)}
              className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
            >
              <span className="mr-2">💰</span>
              Bank Reconcile{selectedInvoices.size > 0 ? ` (${selectedInvoices.size})` : ''}
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
                    ? t.documents.exportSelected
                    : `${t.documents.exportSelected}${
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
                ? t.documents.downloadPdf
                : `${t.documents.downloadPdf}${
                    selectedInvoices.size > 0 ? ` (${selectedInvoices.size})` : ''
                  }`}
            </button>
            <button
              onClick={bulkDelete}
              disabled={selectedInvoices.size === 0}
              className="px-4 py-2 bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-2">🗑️</span>
              {t.documents.deleteSelected} {selectedInvoices.size > 0 && `(${selectedInvoices.size})`}
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
                    className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                </th>
                {needsHorizontalScroll && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)] sticky left-[56px] z-10 bg-[var(--muted)] border-r border-[var(--border)]">{t.documents.table.actions}</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.id}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.vendor}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.invoiceNo}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.date}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.currency}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.total}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.remarkTag}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Handwriting</th>
                {orgRole === 'admin' && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.uploadedBy}</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.verify}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.status}</th>
                {!needsHorizontalScroll && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.actions}</th>
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
                      className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                    />
                  </td>
                  {needsHorizontalScroll && (
                    <td className="px-4 py-3 sticky left-[56px] z-10 bg-white dark:bg-[var(--card)] border-r border-[var(--border)] group-hover:bg-[var(--hover-bg)] dark:group-hover:bg-[var(--hover-bg)]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/documents/${invoice.id}`)}
                          className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          {t.documents.table.open}
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="px-3 py-1 text-sm bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors"
                        >
                          {t.documents.table.delete}
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
                          {invoice.vendor_tax_id && <div>{t.documents.vendorInfo.sst}: {invoice.vendor_tax_id}</div>}
                          {invoice.vendor_tin_number && <div>{t.documents.vendorInfo.tin}: {invoice.vendor_tin_number}</div>}
                          {invoice.vendor_reg_no_new && <div>{t.documents.vendorInfo.regNew}: {invoice.vendor_reg_no_new}</div>}
                          {invoice.vendor_reg_no && !invoice.vendor_reg_no_new && <div>{t.documents.vendorInfo.reg}: {invoice.vendor_reg_no}</div>}
                          {invoice.vendor_reg_no_old && <div>{t.documents.vendorInfo.regOld}: {invoice.vendor_reg_no_old}</div>}
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
                    {invoice.is_duplicate ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
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
                    ) : verifyMap[invoice.id] ? (
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-md ${
                          verifyMap[invoice.id].status === 'ok'
                            ? 'bg-[var(--success)] text-white'
                            : verifyMap[invoice.id].status === 'mismatch'
                            ? 'bg-[var(--warning)] text-[var(--warning-foreground)]'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {verifyMap[invoice.id].status === 'ok' ? t.documents.verify.ok : verifyMap[invoice.id].status === 'mismatch' ? t.documents.verify.check : t.documents.verify.unknown}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {(() => {
                        // Check for status check indicators first
                        const hasStatusChecks = invoice.missing_do || invoice.missing_custom_form || invoice.is_bank_reconciled === false;
                        
                        // Show status check indicators
                        const statusChecks = [];
                        if (invoice.missing_do) {
                          statusChecks.push(
                            <span
                              key="missing_do"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md font-semibold bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                              title="Missing DO number"
                            >
                              ⚠️ Missing DO
                            </span>
                          );
                        }
                        if (invoice.missing_custom_form) {
                          statusChecks.push(
                            <span
                              key="missing_custom_form"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                              title="Missing custom form"
                            >
                              📄 Missing Form
                            </span>
                          );
                        }
                        if (invoice.is_bank_reconciled === false) {
                          statusChecks.push(
                            <span
                              key="not_reconciled"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                              title="Not bank reconciled"
                            >
                              💰 Not Reconciled
                            </span>
                          );
                        }

                        // If there are status checks, show them and skip showing Draft status
                        if (hasStatusChecks) {
                          return statusChecks;
                        }

                        // Otherwise, show the normal status
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
                    </div>
                  </td>
                  {!needsHorizontalScroll && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/documents/${invoice.id}`)}
                          className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          {t.documents.table.open}
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="px-3 py-1 text-sm bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors"
                        >
                          {t.documents.table.delete}
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
              {t.documents.table.showing} {pagination.start} {t.documents.table.to} {pagination.end} {t.documents.table.of} {pagination.total} {t.documents.table.invoices}
            </div>

            <div className="flex gap-2 items-center">
              {/* Previous */}
              {pagination.has_prev ? (
                <button
                  onClick={() => setFilters({ ...filters, page: pagination.prev_num! })}
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <span className="mr-1">←</span>
                  {t.documents.pagination.previous}
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md opacity-50 cursor-not-allowed"
                >
                  <span className="mr-1">←</span>
                  {t.documents.pagination.previous}
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
                  {t.documents.pagination.next}
                  <span className="ml-1">→</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md opacity-50 cursor-not-allowed"
                >
                  {t.documents.pagination.next}
                  <span className="ml-1">→</span>
                </button>
              )}
            </div>

            {/* Items per page */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--muted-foreground)]">{t.documents.pagination.itemsPerPage}</label>
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

      {/* Bank Reconciliation Report Modal */}
      {showReconReportModal && reconReport && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/50"
            onClick={handleCloseReconReportModal}
          />
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
            onClick={handleCloseReconReportModal}
          >
            <div
              className="bg-[var(--card)] rounded-lg border max-w-6xl w-full max-h-[90vh] overflow-y-auto my-auto"
              style={{ 
                borderColor: 'var(--border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-[var(--card)] z-10" style={{ borderBottomColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-xl font-bold m-0" style={{ color: 'var(--foreground)' }}>
                    Bank Reconciliation Report
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Statements searched: {reconReport.statements_searched}
                  </p>
                </div>
                <button
                  onClick={handleCloseReconReportModal}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-2xl transition-colors hover:bg-[var(--muted)]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCreateAllLinks}
                    disabled={isCreatingLinks}
                    className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingLinks ? 'Creating Links...' : 'Create All Links'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAllSupplierStatementLinks}
                    disabled={isCreatingSupplierLinks}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingSupplierLinks ? 'Creating Supplier Links...' : 'Create All Supplier Links'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-md border border-[var(--border)]">
                    <div className="text-xs text-[var(--muted-foreground)]">Total Invoices</div>
                    <div className="text-lg font-semibold">{reconReport.total_invoices}</div>
                  </div>
                  <div className="p-3 rounded-md border border-[var(--border)]">
                    <div className="text-xs text-[var(--muted-foreground)]">Matched Invoices</div>
                    <div className="text-lg font-semibold">{reconReport.matched_invoices}</div>
                  </div>
                  <div className="p-3 rounded-md border border-[var(--border)]">
                    <div className="text-xs text-[var(--muted-foreground)]">Unmatched Invoices</div>
                    <div className="text-lg font-semibold">{reconReport.unmatched_invoices}</div>
                  </div>
                  <div className="p-3 rounded-md border border-[var(--border)]">
                    <div className="text-xs text-[var(--muted-foreground)]">Statements Searched</div>
                    <div className="text-lg font-semibold">{reconReport.statements_searched}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-base font-semibold m-0">Statement Matches</h4>
                  {reconReport.statement_matches.length === 0 ? (
                    <div className="text-sm text-[var(--muted-foreground)]">No statement matches found.</div>
                  ) : (
                    reconReport.statement_matches.map((statement) => (
                      <div
                        key={statement.statement_id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)]"
                      >
                        <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              Statement #{statement.statement_id}
                              {statement.account_number ? ` • ${statement.account_number}` : ''}
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)]">
                              {statement.statement_date_from || '-'} → {statement.statement_date_to || '-'}
                            </div>
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            Transactions: {statement.total_transactions} • Matched: {statement.matched_transactions}
                          </div>
                        </div>
                        {statement.matches.length === 0 ? (
                          <div className="p-4 text-sm text-[var(--muted-foreground)]">No matches in this statement.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-[var(--muted)] border-b border-[var(--border)]">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Transaction</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Matched Invoices</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {statement.matches.map((transaction) => (
                                  <tr key={transaction.transaction_id}>
                                    <td className="px-4 py-3 align-top">
                                      <div className="text-sm font-medium">{formatDate(transaction.transaction_date)}</div>
                                      <div className="text-xs text-[var(--muted-foreground)]">{transaction.description}</div>
                                      <div className="text-xs font-semibold">
                                        {formatAmount(transaction.transaction_amount, null)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {transaction.matched_invoices.length === 0 ? (
                                        <span className="text-sm text-[var(--muted-foreground)]">No invoice matches</span>
                                      ) : (
                                        <div className="space-y-2">
                                          {transaction.matched_invoices
                                            .filter((inv) => inv.match_confidence === 'high' || inv.match_confidence === 'medium')
                                            .map((inv) => {
                                            const linkKey = `${transaction.transaction_id}-${inv.invoice_id}`;
                                            const isCreating = creatingLinkIds.has(linkKey);
                                            const allocatedAmount = toNumber(inv.allocated_amount) ?? toNumber(inv.converted_total) ?? toNumber(inv.invoice_total) ?? 0;
                                            const matchScore = toNumber(inv.match_score) ?? 0;
                                            return (
                                              <div key={inv.invoice_id} className="text-sm border-b border-[var(--border)] pb-2 last:border-b-0">
                                                <div className="font-medium">
                                                  {inv.invoice_no} • {inv.vendor_name}
                                                </div>
                                                <div className="text-xs text-[var(--muted-foreground)]">
                                                  {formatDate(inv.invoice_date)} • {formatAmount(allocatedAmount, inv.invoice_currency)}
                                                </div>
                                                {inv.match_reason && (
                                                  <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                                    {inv.match_reason}
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs mt-1">
                                                  <span className="font-semibold">Score: {matchScore.toFixed(1)}</span>
                                                  <span className={`inline-block px-2 py-0.5 rounded-md ${getConfidenceColor(inv.match_confidence)}`}>
                                                    {inv.match_confidence}
                                                  </span>
                                                </div>
                                                {(() => {
                                                  const invAny = inv as any;
                                                  const supplierMatches = invAny.supplier_statement_matches;
                                                  
                                                  if (supplierMatches && Array.isArray(supplierMatches) && supplierMatches.length > 0) {
                                                    return (
                                                      <div className="mt-2 pt-2 border-t border-[var(--border)]">
                                                        <div className="text-xs font-semibold text-[var(--muted-foreground)] mb-1">
                                                          Supplier Statement Matches ({supplierMatches.length}):
                                                        </div>
                                                        {supplierMatches.map((ssMatch: any, idx: number) => {
                                                          const ssMatchScore = toNumber(ssMatch.match_score) ?? 0;
                                                          const supplierLinkKey = `ss-${ssMatch.line_item_id}-${inv.invoice_id}`;
                                                          const isCreatingSupplierLink = creatingSupplierLinkIds.has(supplierLinkKey);
                                                          return (
                                                            <div key={idx} className="text-xs bg-[var(--muted)] p-2 rounded-md mt-1">
                                                              <div className="font-medium">{ssMatch.supplier_name || 'Unknown Supplier'}</div>
                                                              <div className="text-[var(--muted-foreground)]">
                                                                {formatDate(ssMatch.transaction_date)} • {formatAmount(ssMatch.amount, ssMatch.currency)}
                                                              </div>
                                                              {ssMatch.customer_order_no && (
                                                                <div className="text-[var(--muted-foreground)]">
                                                                  Order: {ssMatch.customer_order_no}
                                                                </div>
                                                              )}
                                                              {ssMatch.bill_of_lading_no && (
                                                                <div className="text-[var(--muted-foreground)]">
                                                                  B/L: {ssMatch.bill_of_lading_no}
                                                                </div>
                                                              )}
                                                              {ssMatch.match_reason && (
                                                                <div className="text-[var(--muted-foreground)] mt-1">
                                                                  {ssMatch.match_reason}
                                                                </div>
                                                              )}
                                                              <div className="flex items-center gap-2 mt-1">
                                                                <span className="font-semibold">Score: {ssMatchScore.toFixed(1)}</span>
                                                                <span className={`inline-block px-2 py-0.5 rounded-md ${getConfidenceColor(ssMatch.match_confidence || 'low')}`}>
                                                                  {ssMatch.match_confidence || 'low'}
                                                                </span>
                                                              </div>
                                                              <button
                                                                onClick={() => handleCreateSupplierStatementLink(
                                                                  ssMatch.line_item_id,
                                                                  inv.invoice_id,
                                                                  ssMatchScore,
                                                                  ssMatch.match_reason
                                                                )}
                                                                disabled={isCreatingSupplierLink}
                                                                className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                              >
                                                                {isCreatingSupplierLink ? 'Creating...' : 'Create Supplier Link'}
                                                              </button>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    );
                                                  }
                                                  return null;
                                                })()}
                                                {(() => {
                                                  const existingLink = getLinkForTransactionInvoice(
                                                    statement.statement_id,
                                                    transaction.transaction_id,
                                                    inv.invoice_id
                                                  );
                                                  if (existingLink) {
                                                    return (
                                                      <button
                                                        onClick={() => handleUnlink(existingLink.id, statement.statement_id)}
                                                        disabled={isCreating}
                                                        className="mt-2 px-3 py-1 text-xs bg-[var(--error)] text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                        Unlink
                                                      </button>
                                                    );
                                                  }
                                                  return (
                                                    <button
                                                      onClick={() => handleCreateSingleLink(
                                                        transaction.transaction_id,
                                                        inv.invoice_id,
                                                        allocatedAmount,
                                                        matchScore,
                                                        inv.match_reason
                                                      )}
                                                      disabled={isCreating}
                                                      className="mt-2 px-3 py-1 text-xs bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                      {isCreating ? 'Creating...' : 'Create Link'}
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-base font-semibold m-0">Invoice Matches</h4>
                  {!reconReport.invoice_matches || reconReport.invoice_matches.length === 0 ? (
                    <div className="text-sm text-[var(--muted-foreground)]">No invoice-centric matches available.</div>
                  ) : (
                    <div className="space-y-3">
                      {reconReport.invoice_matches.map((invoice) => (
                        <div
                          key={invoice.invoice_id}
                          className="rounded-lg border border-[var(--border)] bg-[var(--card)]"
                        >
                          <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">{invoice.invoice_no}</div>
                              <div className="text-xs text-[var(--muted-foreground)]">
                                {formatDate(invoice.invoice_date)} • {formatAmount(invoice.invoice_total, invoice.invoice_currency)}
                              </div>
                            </div>
                            <span className={`inline-block px-2 py-1 text-xs rounded-md ${invoice.matched ? 'bg-[var(--success)] text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                              {invoice.matched ? 'Matched' : 'Unmatched'}
                            </span>
                          </div>
                          {invoice.matched_transactions.length === 0 ? (
                            <div className="p-4 text-sm text-[var(--muted-foreground)]">No matched transactions.</div>
                          ) : (
                            <div className="p-4 space-y-2">
                              {invoice.matched_transactions
                                .filter((tx) => tx.match_confidence === 'high' || tx.match_confidence === 'medium')
                                .map((tx) => {
                                const linkKey = `${tx.transaction_id}-${invoice.invoice_id}`;
                                const isCreating = creatingLinkIds.has(linkKey);
                                const allocatedAmount = toNumber(tx.allocated_amount) ?? toNumber(tx.transaction_amount) ?? 0;
                                const matchScore = toNumber(tx.match_score) ?? 0;
                                return (
                                  <div key={tx.transaction_id} className="text-sm border-b border-[var(--border)] pb-2 last:border-b-0">
                                    <div className="font-medium">
                                      {formatDate(tx.transaction_date)} • {formatAmount(tx.transaction_amount, invoice.invoice_currency)}
                                    </div>
                                    <div className="text-xs text-[var(--muted-foreground)]">{tx.description}</div>
                                    {tx.match_reason && (
                                      <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                        {tx.match_reason}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                      <span>Allocated: {formatAmount(allocatedAmount, invoice.invoice_currency)}</span>
                                      <span className="font-semibold">Score: {matchScore.toFixed(1)}</span>
                                      <span className={`inline-block px-2 py-0.5 rounded-md ${getConfidenceColor(tx.match_confidence)}`}>
                                        {tx.match_confidence}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleCreateSingleLink(
                                        tx.transaction_id,
                                        invoice.invoice_id,
                                        allocatedAmount,
                                        matchScore,
                                        tx.match_reason
                                      )}
                                      disabled={isCreating}
                                      className="mt-2 px-3 py-1 text-xs bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isCreating ? 'Creating...' : 'Create Link'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(() => {
                            const invoiceAny = invoice as any;
                            const supplierMatches = invoiceAny.supplier_statement_matches;
                            
                            if (supplierMatches && Array.isArray(supplierMatches) && supplierMatches.length > 0) {
                              return (
                                <div className="p-4 border-t border-[var(--border)]">
                                  <div className="text-sm font-semibold text-[var(--muted-foreground)] mb-2">
                                    Supplier Statement Matches ({supplierMatches.length}):
                                  </div>
                                  <div className="space-y-2">
                                    {supplierMatches.map((ssMatch: any, idx: number) => {
                                      const ssMatchScore = toNumber(ssMatch.match_score) ?? 0;
                                      const supplierLinkKey = `ss-${ssMatch.line_item_id}-${invoice.invoice_id}`;
                                      const isCreatingSupplierLink = creatingSupplierLinkIds.has(supplierLinkKey);
                                      return (
                                        <div key={idx} className="text-sm bg-[var(--muted)] p-3 rounded-md border border-[var(--border)]">
                                          <div className="font-medium">{ssMatch.supplier_name || 'Unknown Supplier'}</div>
                                          <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                            {formatDate(ssMatch.transaction_date)} • {formatAmount(ssMatch.amount, ssMatch.currency)}
                                          </div>
                                          {ssMatch.customer_order_no && (
                                            <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                              Order: {ssMatch.customer_order_no}
                                            </div>
                                          )}
                                          {ssMatch.bill_of_lading_no && (
                                            <div className="text-xs text-[var(--muted-foreground)]">
                                              B/L: {ssMatch.bill_of_lading_no}
                                            </div>
                                          )}
                                          {ssMatch.match_reason && (
                                            <div className="text-xs text-[var(--muted-foreground)] mt-2 p-2 bg-white dark:bg-gray-800 rounded">
                                              {ssMatch.match_reason}
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2 text-xs mt-2">
                                            <span className="font-semibold">Score: {ssMatchScore.toFixed(1)}</span>
                                            <span className={`inline-block px-2 py-0.5 rounded-md ${getConfidenceColor(ssMatch.match_confidence || 'low')}`}>
                                              {ssMatch.match_confidence || 'low'}
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => handleCreateSupplierStatementLink(
                                              ssMatch.line_item_id,
                                              invoice.invoice_id,
                                              ssMatchScore,
                                              ssMatch.match_reason
                                            )}
                                            disabled={isCreatingSupplierLink}
                                            className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {isCreatingSupplierLink ? 'Creating...' : 'Create Supplier Link'}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      {showCloseConfirmDialog && (
        <>
          <div
            className="fixed inset-0 z-[10000] bg-black/50"
            onClick={cancelCloseReconReportModal}
          />
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            onClick={cancelCloseReconReportModal}
          >
            <div
              className="bg-[var(--card)] rounded-lg border max-w-md w-full p-6"
              style={{ borderColor: 'var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Close Bank Reconciliation Report?
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Are you sure you want to close the bank reconciliation report?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelCloseReconReportModal}
                  className="px-4 py-2 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                  style={{ color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCloseReconReportModal}
                  className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </AppLayout>
  );
};

export default DocumentsListing;