'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import { useToast } from '@/lib/toast';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEntityTaxProfile,
  getFinanceRecord,
  getLatestComplianceCheck,
  listCounterparties,
  listFinanceRecords,
  runMalaysiaComplianceCheck,
  syncInvoicesIntoFinanceRecords,
  updateCounterparty,
  updateEntityTaxProfile,
  type ComplianceCheck,
  type EntityTaxProfile,
  type FinanceCounterparty,
  type FinanceRecord,
  type FinanceRecordDirection,
  type FinanceRecordStatus,
  type FinanceRecordType,
} from '@/services';

type TabKey = 'records' | 'tax_profile' | 'counterparties';

export const allFinanceRecordTypes: Array<{ value: FinanceRecordType; label: string }> = [
  { value: 'ap_invoice', label: 'AP Invoice' },
  { value: 'ar_invoice', label: 'AR Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'payment_proof', label: 'Payment Proof' },
  { value: 'payment_request', label: 'Payment Request' },
  { value: 'bank_transaction', label: 'Bank Transaction' },
  { value: 'import_declaration', label: 'Import Declaration' },
];

interface FinanceOperationsWorkspaceProps {
  direction: FinanceRecordDirection;
  pageTitle: string;
  pageDescription: string;
  recordTypeOptions: Array<{ value: FinanceRecordType; label: string }>;
  balanceLabel: string;
}

const statuses: FinanceRecordStatus[] = [
  'new',
  'extracting',
  'needs_review',
  'missing_information',
  'ready_for_approval',
  'approved',
  'rejected',
  'exported',
  'reconciled',
  'closed',
];

const turnoverBands = [
  'above_100m',
  '25m_to_100m',
  '5m_to_25m',
  'up_to_5m',
  'below_1m',
];

function labelize(value?: string | null) {
  if (!value) return '-';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatMoney(value?: string | number | null, currency = 'MYR') {
  if (value === undefined || value === null || value === '') return '-';
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'MYR',
  }).format(amount);
}

function statusTone(status?: string | null) {
  if (status === 'pass' || status === 'approved' || status === 'reconciled' || status === 'closed') {
    return { background: 'var(--success-light)', color: 'var(--success-dark)' };
  }
  if (status === 'fail' || status === 'rejected' || status === 'missing_information') {
    return { background: 'var(--error-light)', color: 'var(--error-dark)' };
  }
  if (status === 'warning' || status === 'needs_review' || status === 'ready_for_approval') {
    return { background: 'var(--warning-light)', color: 'var(--warning-dark)' };
  }
  return { background: 'var(--muted)', color: 'var(--muted-foreground)' };
}

function Badge({ value }: { value?: string | null }) {
  const tone = statusTone(value);
  return (
    <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium" style={tone}>
      {labelize(value)}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'select';
  options?: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <option value="">Unset</option>
          {options?.map((option) => (
            <option key={option} value={option}>
              {labelize(option)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      )}
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function FinanceOperationsWorkspace({
  direction,
  pageTitle,
  pageDescription,
  recordTypeOptions,
  balanceLabel,
}: FinanceOperationsWorkspaceProps) {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('records');
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [counterparties, setCounterparties] = useState<FinanceCounterparty[]>([]);
  const [taxProfile, setTaxProfile] = useState<EntityTaxProfile>({});
  const [selectedRecord, setSelectedRecord] = useState<FinanceRecord | null>(null);
  const [latestCheck, setLatestCheck] = useState<ComplianceCheck | null>(null);
  const [editingCounterparty, setEditingCounterparty] = useState<FinanceCounterparty | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingCounterparty, setIsSavingCounterparty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<{
    record_type: '' | FinanceRecordType;
    status: '' | FinanceRecordStatus;
  }>({
    record_type: '',
    status: '',
  });

  const pageSize = 50;

  const summary = useMemo(() => {
    const balanceTotal = records
      .reduce((sum, record) => sum + (Number(record.balance_due ?? record.total_amount) || 0), 0);
    const reviewCount = records.filter((record) =>
      ['needs_review', 'missing_information', 'ready_for_approval'].includes(record.status)
    ).length;
    const complianceRiskCount = records.filter((record) =>
      ['warning', 'fail', 'needs_review'].includes(record.compliance_status || '')
    ).length;

    return { balanceTotal, reviewCount, complianceRiskCount, recordCount: records.length };
  }, [records]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listFinanceRecords({
        page,
        page_size: pageSize,
        direction,
        record_type: filters.record_type || undefined,
        status: filters.status || undefined,
      });
      setRecords(response.data.records);
      setTotal(response.data.total);
      setTotalPages(response.data.total_pages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load finance records';
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [direction, filters, page, pageSize, showToast]);

  const loadTaxProfile = useCallback(async () => {
    try {
      const response = await getEntityTaxProfile();
      setTaxProfile(response.data || {});
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load tax profile', { type: 'error' });
    }
  }, [showToast]);

  const loadCounterparties = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await listCounterparties();
      setCounterparties(response.data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load counterparties', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords, selectedOrganizationId]);

  useEffect(() => {
    const queryRecordType = typeof router.query.record_type === 'string' ? router.query.record_type : '';
    const isAllowed = recordTypeOptions.some((option) => option.value === queryRecordType);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      record_type: isAllowed ? (queryRecordType as FinanceRecordType) : '',
    }));
  }, [recordTypeOptions, router.query.record_type]);

  useEffect(() => {
    if (activeTab === 'tax_profile') loadTaxProfile();
    if (activeTab === 'counterparties') loadCounterparties();
  }, [activeTab, loadCounterparties, loadTaxProfile, selectedOrganizationId]);

  async function handleSyncInvoices() {
    setIsSyncing(true);
    try {
      const response = await syncInvoicesIntoFinanceRecords();
      showToast(response.message || 'Invoices synced into finance records', { type: 'success' });
      setPage(1);
      await loadRecords();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to sync invoices', { type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  }

  async function openRecord(record: FinanceRecord) {
    setSelectedRecord(record);
    setLatestCheck(null);
    try {
      const [detailResponse, complianceResponse] = await Promise.all([
        getFinanceRecord(record.id),
        getLatestComplianceCheck(record.id),
      ]);
      setSelectedRecord(detailResponse.data);
      setLatestCheck(complianceResponse.data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load finance record detail', { type: 'error' });
    }
  }

  async function handleRunCompliance(recordId: number) {
    setIsRunningCheck(true);
    try {
      const response = await runMalaysiaComplianceCheck(recordId);
      setLatestCheck(response.data);
      showToast(response.message || 'Compliance check completed', { type: 'success' });
      await loadRecords();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to run compliance check', { type: 'error' });
    } finally {
      setIsRunningCheck(false);
    }
  }

  async function handleSaveTaxProfile() {
    setIsSavingProfile(true);
    try {
      const response = await updateEntityTaxProfile(taxProfile);
      setTaxProfile(response.data);
      showToast('Entity tax profile saved', { type: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save tax profile', { type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSaveCounterparty() {
    if (!editingCounterparty) return;
    setIsSavingCounterparty(true);
    try {
      await updateCounterparty(editingCounterparty.id, editingCounterparty);
      showToast('Counterparty updated', { type: 'success' });
      setEditingCounterparty(null);
      await loadCounterparties();
      await loadRecords();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update counterparty', { type: 'error' });
    } finally {
      setIsSavingCounterparty(false);
    }
  }

  return (
    <AppLayout pageName={pageTitle}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              {pageTitle}
            </h1>
            <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {pageDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncInvoices}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Invoices'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-md border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium uppercase" style={{ color: 'var(--muted-foreground)' }}>{balanceLabel}</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{formatMoney(summary.balanceTotal)}</div>
          </div>
          <div className="rounded-md border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium uppercase" style={{ color: 'var(--muted-foreground)' }}>Records</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{summary.recordCount}</div>
          </div>
          <div className="rounded-md border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium uppercase" style={{ color: 'var(--muted-foreground)' }}>Needs Review</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{summary.reviewCount}</div>
          </div>
          <div className="rounded-md border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium uppercase" style={{ color: 'var(--muted-foreground)' }}>Compliance Risk</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{summary.complianceRiskCount}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
          {[
            ['records', `${direction} Records`, ClipboardCheck],
            ['tax_profile', 'Entity Tax Profile', ShieldCheck],
            ['counterparties', 'Counterparties', UserRoundCog],
          ].map(([key, label, Icon]) => {
            const TabIcon = Icon as typeof ClipboardCheck;
            return (
              <button
                key={key as string}
                type="button"
                onClick={() => setActiveTab(key as TabKey)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                style={{
                  borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === key ? 'var(--foreground)' : 'var(--muted-foreground)',
                }}
              >
                <TabIcon className="h-4 w-4" />
                {label as string}
              </button>
            );
          })}
        </div>

        {activeTab === 'records' && (
          <div className="space-y-4">
            <div className="rounded-md border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                <Search className="h-4 w-4" />
                Filters
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field
                  label="Record Type"
                  type="select"
                  value={filters.record_type}
                  options={recordTypeOptions.map((type) => type.value)}
                  onChange={(value) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, record_type: value as '' | FinanceRecordType }));
                  }}
                />
                <Field
                  label="Status"
                  type="select"
                  value={filters.status}
                  options={statuses}
                  onChange={(value) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, status: value as '' | FinanceRecordStatus }));
                  }}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setFilters({ record_type: '', status: '' });
                    }}
                    className="w-full rounded-md border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              {error && (
                <div className="border-b px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--error)' }}>
                  {error}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Record', 'Counterparty', 'Direction', 'Status', 'Compliance', 'Date', 'Due', 'Total', 'Balance', ''].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--muted-foreground)' }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                          Loading finance records...
                        </td>
                      </tr>
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                          No finance records found. Sync invoices to create AP/AR work items.
                        </td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr
                          key={record.id}
                          onClick={() => openRecord(record)}
                          className="cursor-pointer hover:bg-[var(--muted)]"
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: 'var(--foreground)' }}>{record.record_number || `Record #${record.id}`}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{labelize(record.record_type)}</div>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>
                            {record.counterparty?.name || '-'}
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {record.counterparty?.country || 'Country unset'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{record.direction}</td>
                          <td className="px-4 py-3"><Badge value={record.status} /></td>
                          <td className="px-4 py-3"><Badge value={record.compliance_status || 'not_checked'} /></td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{formatDate(record.record_date)}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{formatDate(record.due_date)}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{formatMoney(record.total_amount, record.currency || 'MYR')}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{formatMoney(record.balance_due, record.currency || 'MYR')}</td>
                          <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--primary)' }}>Open</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                <span>Showing {records.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="rounded-md border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    className="rounded-md border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tax_profile' && (
          <div className="rounded-md border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Malaysia Compliance Profile</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Used by readiness checks for e-Invoice, SST/service tax, withholding tax, and import K1 screening.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveTaxProfile}
                disabled={isSavingProfile}
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Save className="h-4 w-4" />
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Country" value={taxProfile.country || ''} onChange={(value) => setTaxProfile((prev) => ({ ...prev, country: value }))} />
              <Field label="Annual Turnover Band" type="select" options={turnoverBands} value={taxProfile.annual_turnover_band || ''} onChange={(value) => setTaxProfile((prev) => ({ ...prev, annual_turnover_band: value }))} />
              <Field label="e-Invoice Required From" type="date" value={(taxProfile.einvoice_required_from || '').slice(0, 10)} onChange={(value) => setTaxProfile((prev) => ({ ...prev, einvoice_required_from: value }))} />
              <Field label="Tax Identification Number" value={taxProfile.tax_identification_number || ''} onChange={(value) => setTaxProfile((prev) => ({ ...prev, tax_identification_number: value }))} />
              <Field label="Business Registration Number" value={taxProfile.business_registration_number || ''} onChange={(value) => setTaxProfile((prev) => ({ ...prev, business_registration_number: value }))} />
              <ToggleField label="Malaysian Taxpayer" value={Boolean(taxProfile.is_malaysian_taxpayer)} onChange={(value) => setTaxProfile((prev) => ({ ...prev, is_malaysian_taxpayer: value }))} />
              <ToggleField label="SST Registered" value={Boolean(taxProfile.sst_registered)} onChange={(value) => setTaxProfile((prev) => ({ ...prev, sst_registered: value }))} />
              <ToggleField label="Service Tax Registered" value={Boolean(taxProfile.service_tax_registered)} onChange={(value) => setTaxProfile((prev) => ({ ...prev, service_tax_registered: value }))} />
              <ToggleField label="Importer" value={Boolean(taxProfile.importer_flag)} onChange={(value) => setTaxProfile((prev) => ({ ...prev, importer_flag: value }))} />
            </div>
          </div>
        )}

        {activeTab === 'counterparties' && (
          <div className="overflow-hidden rounded-md border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Counterparty Compliance Data</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Complete residency, tax IDs, service category, and bank defaults for AP/AR review.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Type', 'Country', 'Resident', 'TIN', 'Goods/Services', 'Service Type', ''].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--muted-foreground)' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {counterparties.map((counterparty) => (
                    <tr key={counterparty.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>{counterparty.name}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{counterparty.counterparty_type || '-'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{counterparty.country || '-'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{counterparty.is_resident === null || counterparty.is_resident === undefined ? '-' : counterparty.is_resident ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{counterparty.tax_identification_number || '-'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{counterparty.goods_or_services || '-'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{counterparty.service_type || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingCounterparty(counterparty)}
                          className="rounded-md border px-3 py-1.5 text-sm font-medium"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && counterparties.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        No counterparties found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-[9998] flex justify-end bg-black/40" onClick={() => setSelectedRecord(null)}>
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto border-l p-5"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{labelize(selectedRecord.record_type)} / {selectedRecord.direction}</div>
                <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {selectedRecord.record_number || `Record #${selectedRecord.id}`}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedRecord(null)} className="rounded-md p-2 hover:bg-[var(--muted)]" style={{ color: 'var(--foreground)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>Status</div>
                <div className="mt-2"><Badge value={selectedRecord.status} /></div>
              </div>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>Compliance</div>
                <div className="mt-2"><Badge value={latestCheck?.status || selectedRecord.compliance_status || 'not_checked'} /></div>
              </div>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>Total</div>
                <div className="mt-2 font-semibold" style={{ color: 'var(--foreground)' }}>{formatMoney(selectedRecord.total_amount, selectedRecord.currency || 'MYR')}</div>
              </div>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>Balance Due</div>
                <div className="mt-2 font-semibold" style={{ color: 'var(--foreground)' }}>{formatMoney(selectedRecord.balance_due, selectedRecord.currency || 'MYR')}</div>
              </div>
            </div>

            <div className="mt-5 rounded-md border p-4" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-3 font-semibold" style={{ color: 'var(--foreground)' }}>Counterparty</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span style={{ color: 'var(--muted-foreground)' }}>Name: </span><span style={{ color: 'var(--foreground)' }}>{selectedRecord.counterparty?.name || '-'}</span></div>
                <div><span style={{ color: 'var(--muted-foreground)' }}>Country: </span><span style={{ color: 'var(--foreground)' }}>{selectedRecord.counterparty?.country || '-'}</span></div>
                <div><span style={{ color: 'var(--muted-foreground)' }}>Resident: </span><span style={{ color: 'var(--foreground)' }}>{selectedRecord.counterparty?.is_resident === undefined || selectedRecord.counterparty?.is_resident === null ? '-' : selectedRecord.counterparty.is_resident ? 'Yes' : 'No'}</span></div>
                <div><span style={{ color: 'var(--muted-foreground)' }}>TIN: </span><span style={{ color: 'var(--foreground)' }}>{selectedRecord.counterparty?.tax_identification_number || '-'}</span></div>
              </div>
            </div>

            <div className="mt-5 rounded-md border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Malaysia Compliance Check</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Deterministic readiness screen, not final tax advice.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRunCompliance(selectedRecord.id)}
                  disabled={isRunningCheck}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isRunningCheck ? 'Checking...' : 'Run Check'}
                </button>
              </div>
              {latestCheck ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md p-3" style={{ background: 'var(--muted)' }}>
                    <div className="flex items-center gap-2">
                      {latestCheck.status === 'pass' ? <CheckCircle2 className="h-5 w-5 text-[var(--success)]" /> : <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />}
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{latestCheck.summary || 'Compliance check completed'}</div>
                        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{latestCheck.ruleset} / score {latestCheck.readiness_score ?? '-'}</div>
                      </div>
                    </div>
                    <Badge value={latestCheck.status} />
                  </div>
                  {latestCheck.findings.map((finding) => (
                    <div key={finding.id} className="rounded-md border p-3" style={{ borderColor: 'var(--border)' }}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium" style={{ color: 'var(--foreground)' }}>{finding.title}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{finding.rule_key} / {labelize(finding.applicability)} / confidence {finding.confidence ?? '-'}</div>
                        </div>
                        <Badge value={finding.severity} />
                      </div>
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{finding.message}</p>
                      {finding.required_action && (
                        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--warning-dark)' }}>{finding.required_action}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                  No compliance check has been run for this record yet.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {editingCounterparty && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingCounterparty(null)}>
          <div className="w-full max-w-3xl rounded-md border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{editingCounterparty.name}</h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Counterparty tax and payment profile</p>
              </div>
              <button type="button" onClick={() => setEditingCounterparty(null)} className="rounded-md p-2 hover:bg-[var(--muted)]" style={{ color: 'var(--foreground)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Country" value={editingCounterparty.country || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, country: value } : prev)} />
              <Field label="TIN" value={editingCounterparty.tax_identification_number || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, tax_identification_number: value } : prev)} />
              <Field label="Business Registration No" value={editingCounterparty.business_registration_number || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, business_registration_number: value } : prev)} />
              <Field label="SST Number" value={editingCounterparty.sst_number || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, sst_number: value } : prev)} />
              <Field label="Service Tax Number" value={editingCounterparty.service_tax_number || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, service_tax_number: value } : prev)} />
              <Field label="Goods or Services" value={editingCounterparty.goods_or_services || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, goods_or_services: value } : prev)} />
              <Field label="Service Type" value={editingCounterparty.service_type || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, service_type: value } : prev)} />
              <Field label="Default Bank" value={editingCounterparty.default_bank_name || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, default_bank_name: value } : prev)} />
              <Field label="Bank Account No" value={editingCounterparty.default_bank_account_number || ''} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, default_bank_account_number: value } : prev)} />
              <ToggleField label="Resident" value={Boolean(editingCounterparty.is_resident)} onChange={(value) => setEditingCounterparty((prev) => prev ? { ...prev, is_resident: value } : prev)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCounterparty(null)} className="rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveCounterparty} disabled={isSavingCounterparty} className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <Save className="h-4 w-4" />
                {isSavingCounterparty ? 'Saving...' : 'Save Counterparty'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
