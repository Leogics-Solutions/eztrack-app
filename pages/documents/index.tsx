'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Plus } from "lucide-react";

// Types
interface Vendor {
  id: number;
  name: string;
}

interface Remark {
  remarks: string;
}

interface Invoice {
  id: number;
  vendor_name?: string;
  vendor_tax_id?: string;
  vendor_tin_number?: string;
  vendor_reg_no?: string;
  vendor_reg_no_new?: string;
  vendor_reg_no_old?: string;
  invoice_no?: string;
  invoice_date?: string;
  currency?: string;
  total?: number;
  remarks?: string;
  created_by_name?: string;
  created_by_email?: string;
  status?: 'draft' | 'validated' | 'posted';
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

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [verifyMap, setVerifyMap] = useState<Record<number, VerifyStatus>>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [orgRole, setOrgRole] = useState<string>('member');

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

  // Mock data loading - Replace with actual API calls
  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    // TODO: Replace with actual API calls
    // For now, using mock data
    setInvoices([
      {
        id: 1,
        vendor_name: 'Sample Vendor Ltd',
        vendor_tax_id: 'SST123456',
        vendor_tin_number: 'TIN987654',
        vendor_reg_no_new: '202301234567',
        invoice_no: 'INV-2024-001',
        invoice_date: '2024-01-15',
        currency: 'MYR',
        total: 1500.00,
        remarks: 'Office Supplies',
        created_by_name: 'John Doe',
        created_by_email: 'john@example.com',
        status: 'posted',
      },
      // Add more mock data as needed
    ]);

    setVendors([
      { id: 1, name: 'Sample Vendor Ltd' },
      { id: 2, name: 'Another Vendor Co' },
    ]);

    setRemarks([
      { remarks: 'Office Supplies' },
      { remarks: 'Equipment' },
      { remarks: 'Services' },
    ]);

    setVerifyMap({
      1: { status: 'ok' },
    });

    setTotalCount(1);
    setPagination({
      page: 1,
      has_prev: false,
      has_next: false,
      start: 1,
      end: 1,
      total: 1,
      iter_pages: () => [1],
    });
  };

  // Filter functions
  const toggleFilters = () => {
    setFiltersVisible(!filtersVisible);
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
      alert(t.documents.alerts.selectAtLeastOne);
      return;
    }
    const message = t.documents.alerts.deleteConfirm.replace('{count}', selectedInvoices.size.toString());
    if (!confirm(message)) {
      return;
    }
    // TODO: Implement bulk delete API call
    console.log('Bulk delete:', Array.from(selectedInvoices));
  };

  const exportSelected = async () => {
    if (selectedInvoices.size === 0) {
      alert(t.documents.alerts.exportSelectAtLeastOne);
      return;
    }
    // TODO: Implement export API call
    console.log('Export:', Array.from(selectedInvoices));
  };

  const deleteInvoice = async (invoiceId: number) => {
    const message = t.documents.alerts.deleteConfirmSingle.replace('{id}', invoiceId.toString());
    if (!confirm(message)) {
      return;
    }
    // TODO: Implement delete API call
    console.log('Delete invoice:', invoiceId);
  };

  const recalcIndicators = () => {
    alert(t.documents.alerts.verifyIndicators);
  };

  return (
    <AppLayout pageName={t.documents.title}>
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
            {/* Date Range */}
            <div className="mb-6">
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
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">{t.documents.filters.search}</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder={t.documents.filters.searchPlaceholder}
                className="w-full max-w-lg px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
            </div>

            {/* Remark/Tag */}
            <div className="mb-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">{t.documents.filters.status}</label>
                <div className="space-y-2">
                  {['draft', 'validated', 'posted'].map((status) => (
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
                         status === 'posted' ? t.dashboard.status.posted : status}
                      </span>
                    </label>
                  ))}
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

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
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
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => router.push('/documents/new')}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center"
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
              onClick={recalcIndicators}
              className="px-4 py-2 border border-[var(--border)] hover:text-white rounded-md hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)] transition-colors"
            >
              <span className="mr-2">✓</span>
              {t.documents.verifySubtotals}
            </button>
            <button
              onClick={exportSelected}
              disabled={selectedInvoices.size === 0}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-2">📤</span>
              {t.documents.exportSelected} {selectedInvoices.size > 0 && `(${selectedInvoices.size})`}
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
        <div className="overflow-x-auto">
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.id}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.vendor}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.invoiceNo}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.date}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.currency}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.total}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.remarkTag}</th>
                {orgRole === 'admin' && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.uploadedBy}</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.verify}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.status}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.table.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.has(invoice.id)}
                      onChange={() => toggleInvoiceSelection(invoice.id)}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                  </td>
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
                        {verifyMap[invoice.id].status === 'ok' ? t.documents.verify.ok : verifyMap[invoice.id].status === 'mismatch' ? t.documents.verify.check : t.documents.verify.unknown}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-md ${
                        invoice.status === 'posted'
                          ? 'bg-[var(--success)] text-white'
                          : invoice.status === 'validated'
                          ? 'bg-[var(--info)] text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {invoice.status === 'draft' ? t.dashboard.status.draft :
                       invoice.status === 'validated' ? t.dashboard.status.validated :
                       invoice.status === 'posted' ? t.dashboard.status.posted : invoice.status || t.dashboard.status.draft}
                    </span>
                  </td>
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
    </AppLayout>
  );
};

export default DocumentsListing;