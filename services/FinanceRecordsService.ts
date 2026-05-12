import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

export type FinanceRecordDirection = 'AP' | 'AR';
export type FinanceRecordType =
  | 'ap_invoice'
  | 'ar_invoice'
  | 'credit_note'
  | 'debit_note'
  | 'receipt'
  | 'payment_proof'
  | 'payment_request'
  | 'bank_transaction'
  | 'import_declaration';

export type FinanceRecordStatus =
  | 'new'
  | 'extracting'
  | 'needs_review'
  | 'missing_information'
  | 'ready_for_approval'
  | 'approved'
  | 'rejected'
  | 'exported'
  | 'reconciled'
  | 'closed';

export type ComplianceStatus = 'pass' | 'warning' | 'fail' | 'needs_review';
export type ComplianceApplicability =
  | 'not_applicable'
  | 'possibly_applicable'
  | 'applicable'
  | 'missing_info'
  | 'human_review_required';
export type ComplianceSeverity = 'info' | 'low' | 'medium' | 'high';

export interface FinanceCounterparty {
  id: number;
  name: string;
  counterparty_type?: string | null;
  country?: string | null;
  is_resident?: boolean | null;
  tax_identification_number?: string | null;
  business_registration_number?: string | null;
  sst_number?: string | null;
  service_tax_number?: string | null;
  goods_or_services?: string | null;
  service_type?: string | null;
  default_bank_name?: string | null;
  default_bank_account_number?: string | null;
}

export interface FinanceRecord {
  id: number;
  invoice_id?: number | null;
  record_type: FinanceRecordType;
  direction: FinanceRecordDirection;
  status: FinanceRecordStatus;
  record_number?: string | null;
  record_date?: string | null;
  due_date?: string | null;
  currency?: string | null;
  subtotal?: string | number | null;
  tax_amount?: string | number | null;
  total_amount?: string | number | null;
  balance_due?: string | number | null;
  source_channel?: string | null;
  compliance_status?: ComplianceStatus | null;
  counterparty?: FinanceCounterparty | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface ComplianceFinding {
  id: number;
  rule_key: string;
  title: string;
  applicability: ComplianceApplicability;
  severity: ComplianceSeverity;
  message: string;
  evidence?: Record<string, unknown> | null;
  required_action?: string | null;
  confidence?: number | null;
}

export interface ComplianceCheck {
  id: number;
  finance_record_id: number;
  ruleset: string;
  status: ComplianceStatus;
  readiness_score?: number | null;
  summary?: string | null;
  findings: ComplianceFinding[];
}

export interface EntityTaxProfile {
  id?: number;
  country?: string | null;
  is_malaysian_taxpayer?: boolean | null;
  annual_turnover_band?: string | null;
  einvoice_required_from?: string | null;
  sst_registered?: boolean | null;
  service_tax_registered?: boolean | null;
  importer_flag?: boolean | null;
  tax_identification_number?: string | null;
  business_registration_number?: string | null;
}

export interface ListFinanceRecordsParams {
  direction?: FinanceRecordDirection;
  record_type?: FinanceRecordType;
  status?: FinanceRecordStatus;
  page?: number;
  page_size?: number;
}

export interface PaginatedFinanceRecords {
  records: FinanceRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListFinanceRecordsResponse {
  success: boolean;
  message?: string;
  data: PaginatedFinanceRecords;
}

export interface SyncInvoicesResponse {
  success: boolean;
  message: string;
  data: FinanceRecord[];
}

export interface FinanceRecordResponse {
  success: boolean;
  message?: string;
  data: FinanceRecord;
}

export interface CounterpartiesResponse {
  success: boolean;
  message?: string;
  data: FinanceCounterparty[];
}

export interface EntityTaxProfileResponse {
  success: boolean;
  message?: string;
  data: EntityTaxProfile;
}

export interface ComplianceCheckResponse {
  success: boolean;
  message?: string;
  data: ComplianceCheck | null;
}

interface FinanceRecordsListPayload {
  success?: boolean;
  message?: string;
  data?:
    | FinanceRecord[]
    | {
        records?: FinanceRecord[];
        items?: FinanceRecord[];
        finance_records?: FinanceRecord[];
        total?: number;
        page?: number;
        page_size?: number;
        total_pages?: number;
        meta?: PaginationMeta;
      };
  meta?: PaginationMeta;
}

interface PaginationMeta {
  page?: number;
  page_size?: number;
  total?: number;
  total_items?: number;
  total_pages?: number;
}

function normalizeRecordsPayload(
  payload: FinanceRecordsListPayload,
  fallbackPage = 1,
  fallbackPageSize = 50
): PaginatedFinanceRecords {
  const rawData = payload.data;
  const rawObject = Array.isArray(rawData) ? undefined : rawData;
  const records = Array.isArray(rawData)
    ? rawData
    : rawObject?.records || rawObject?.items || rawObject?.finance_records || [];
  const meta = payload.meta || rawObject?.meta || {};
  const total = rawObject?.total ?? meta.total_items ?? meta.total ?? records.length;
  const page = rawObject?.page ?? meta.page ?? fallbackPage;
  const pageSize = rawObject?.page_size ?? meta.page_size ?? fallbackPageSize;

  return {
    records,
    total,
    page,
    page_size: pageSize,
    total_pages: rawObject?.total_pages ?? meta.total_pages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function syncInvoicesIntoFinanceRecords(invoiceId?: number): Promise<SyncInvoicesResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/sync-invoices`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(invoiceId ? { invoice_id: invoiceId } : {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to sync invoices into finance records');
  }

  return response.json();
}

export async function listFinanceRecords(params?: ListFinanceRecordsParams): Promise<ListFinanceRecordsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.direction) queryParams.append('direction', params.direction);
  if (params?.record_type) queryParams.append('record_type', params.record_type);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.page_size) queryParams.append('page_size', String(params.page_size));

  const url = `${BASE_URL}/finance-records${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load finance records');
  }

  const payload = (await response.json()) as FinanceRecordsListPayload;
  return {
    success: payload.success ?? true,
    message: payload.message,
    data: normalizeRecordsPayload(payload, params?.page, params?.page_size),
  };
}

export async function getFinanceRecord(recordId: number): Promise<FinanceRecordResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/${recordId}`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load finance record');
  }

  return response.json();
}

export async function getEntityTaxProfile(): Promise<EntityTaxProfileResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/entity-tax-profile`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load entity tax profile');
  }

  return response.json();
}

export async function updateEntityTaxProfile(profile: EntityTaxProfile): Promise<EntityTaxProfileResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/entity-tax-profile`, {
    method: 'PUT',
    headers: getScopedHeaders(),
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update entity tax profile');
  }

  return response.json();
}

export async function listCounterparties(): Promise<CounterpartiesResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/counterparties`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load counterparties');
  }

  const payload = await response.json();
  return {
    success: payload.success ?? true,
    message: payload.message,
    data: Array.isArray(payload.data) ? payload.data : payload.data?.items || payload.data?.counterparties || [],
  };
}

export async function updateCounterparty(
  counterpartyId: number,
  counterparty: Partial<FinanceCounterparty>
): Promise<{ success: boolean; message?: string; data: FinanceCounterparty }> {
  const response = await fetch(`${BASE_URL}/finance-records/counterparties/${counterpartyId}`, {
    method: 'PATCH',
    headers: getScopedHeaders(),
    body: JSON.stringify(counterparty),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update counterparty');
  }

  return response.json();
}

export async function runMalaysiaComplianceCheck(recordId: number): Promise<ComplianceCheckResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/${recordId}/compliance-checks`, {
    method: 'POST',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to run compliance check');
  }

  return response.json();
}

export async function getLatestComplianceCheck(recordId: number): Promise<ComplianceCheckResponse> {
  const response = await fetch(`${BASE_URL}/finance-records/${recordId}/compliance-checks/latest`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load latest compliance check');
  }

  return response.json();
}
