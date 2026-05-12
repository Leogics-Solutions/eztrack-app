import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';
import { BASE_URL } from './config';

export type PaymentGatewayProvider = 'payex' | 'foodpanda' | 'grab' | string;
export type PaymentGatewayBatchStatus = 'ready' | 'processing' | 'failed' | string;
export type PaymentGatewayMatchStatus = 'matched' | 'warning' | 'unmatched' | string;
export type PaymentGatewayMatchType = 'auto' | 'manual' | string;

export interface PaymentGatewayBatch {
  id: number;
  provider?: PaymentGatewayProvider;
  status?: PaymentGatewayBatchStatus;
  file_count?: number;
  transaction_count?: number;
  successful_transaction_count?: number;
  settlement_row_count?: number;
  matched_count?: number;
  warning_count?: number;
  unmatched_transaction_count?: number;
  unmatched_settlement_count?: number;
  imported_transaction_count?: number;
  skipped_transaction_count?: number;
  imported_settlement_count?: number;
  skipped_settlement_count?: number;
  created_at?: string;
}

export interface PaymentGatewayFile {
  id: number;
  file_type?: 'transaction' | 'settlement' | string;
  filename?: string;
  status?: string;
  imported_count?: number;
  skipped_count?: number;
}

export interface PaymentGatewayTransactionRow {
  id: number;
  batch_id?: number;
  transaction_id?: string;
  TransactionId?: string;
  provider_transaction_id?: string;
  transaction_date?: string;
  TransactionDate?: string;
  status?: string;
  Status?: string;
  amount?: number | string;
  Amount?: number | string;
  settlement_id?: string | null;
  SettlementId?: string | null;
  reference_number?: string | null;
  ReferenceNumber?: string | null;
  customer_name?: string | null;
  customer?: string | null;
  merchant?: string | null;
  txn_type?: string | null;
  transaction_type?: string | null;
  row_type?: string | null;
  description?: string | null;
  currency?: string | null;
  link?: PaymentGatewayRowLink | null;
  bank_link?: PaymentGatewayBankLink | null;
  [key: string]: unknown;
}

export interface PaymentGatewaySettlementRow {
  id: number;
  batch_id?: number;
  settlement_id?: string;
  SettlementId?: string;
  transaction_id?: string;
  TransactionId?: string;
  provider_transaction_id?: string;
  settlement_date?: string;
  SettlementDate?: string;
  gross?: number | string;
  Gross?: number | string;
  gross_amount?: number | string;
  net?: number | string;
  Net?: number | string;
  net_amount?: number | string;
  fee?: number | string;
  Fee?: number | string;
  mdr_amount?: number | string;
  reference_number?: string | null;
  ReferenceNumber?: string | null;
  merchant?: string | null;
  customer?: string | null;
  txn_type?: string | null;
  transaction_type?: string | null;
  row_type?: string | null;
  description?: string | null;
  currency?: string | null;
  link?: PaymentGatewayRowLink | null;
  bank_link?: PaymentGatewayBankLink | null;
  [key: string]: unknown;
}

export interface PaymentGatewayReconciliationLink {
  id: number;
  transaction_row_id: number;
  settlement_row_id: number;
  match_type?: PaymentGatewayMatchType;
  match_status?: PaymentGatewayMatchStatus;
  notes?: string | null;
  created_at?: string;
  transaction?: PaymentGatewayTransactionRow;
  settlement_row?: PaymentGatewaySettlementRow;
  settlement?: PaymentGatewaySettlementRow;
  [key: string]: unknown;
}

export interface PaymentGatewayRowLink {
  match_status?: PaymentGatewayMatchStatus;
  [key: string]: unknown;
}

export interface PaymentGatewayBankLink {
  bank_transaction_id?: number;
  match_status?: PaymentGatewayMatchStatus;
  allocated_amount?: string | number;
  bank_transaction?: {
    transaction_date?: string;
    description?: string;
    credit_amount?: string | number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ListPaymentGatewayBatchesParams {
  page?: number;
  page_size?: number;
  provider?: PaymentGatewayProvider;
}

export interface ListPaymentGatewayBatchesResponse {
  success: boolean;
  message?: string;
  data: PaymentGatewayBatch[];
  meta?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface UploadPaymentGatewayReconciliationResponse {
  success: boolean;
  message?: string;
  data: {
    batch: PaymentGatewayBatch;
    files: PaymentGatewayFile[];
  };
}

export interface GetPaymentGatewayReconciliationResponse {
  success: boolean;
  message?: string;
  data: {
    batch: PaymentGatewayBatch;
    files?: PaymentGatewayFile[];
    matched_links?: PaymentGatewayReconciliationLink[];
    warning_links?: PaymentGatewayReconciliationLink[];
    unmatched_transactions?: PaymentGatewayTransactionRow[];
    unmatched_successful_transactions?: PaymentGatewayTransactionRow[];
    unmatched_settlement_rows?: PaymentGatewaySettlementRow[];
    [key: string]: unknown;
  };
}

export interface ListPaymentGatewayTransactionsParams {
  page?: number;
  page_size?: number;
  status?: string;
  matched?: boolean;
  settlement_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface ListPaymentGatewaySettlementRowsParams {
  page?: number;
  page_size?: number;
  matched?: boolean;
  settlement_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedRowsResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  meta?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface PaymentGatewayBankReconciliationLink {
  id: number;
  batch_id?: number;
  bank_transaction_id: number;
  settlement_id?: string | null;
  settlement_row_ids?: number[];
  selected_net_amount?: number | string;
  bank_transaction_amount?: number | string;
  match_status?: PaymentGatewayMatchStatus;
  status?: PaymentGatewayMatchStatus;
  notes?: string | null;
  created_at?: string;
  bank_transaction?: Record<string, unknown>;
  settlement_rows?: PaymentGatewaySettlementRow[];
  [key: string]: unknown;
}

export interface CreatePaymentGatewayBankReconciliationLinkRequest {
  bank_transaction_id: number;
  batch_id?: number;
  settlement_id?: string;
  settlement_row_ids?: number[];
  notes?: string;
}

export interface CreatePaymentGatewayBankReconciliationLinkResponse {
  success: boolean;
  message?: string;
  data: PaymentGatewayBankReconciliationLink;
}

export interface ListPaymentGatewayBankReconciliationLinksResponse {
  success: boolean;
  message?: string;
  data: PaymentGatewayBankReconciliationLink[];
}

export interface DeletePaymentGatewayBankReconciliationLinkResponse {
  success: boolean;
  message?: string;
  data: null;
}

export interface DeletePaymentGatewayReconciliationResponse {
  success: boolean;
  message?: string;
  data: null;
}

export interface AutoReconcileBankRequest {
  bank_statement_ids: number[];
  date_tolerance_days?: number;
  amount_tolerance_pct?: number;
  use_llm?: boolean;
}

export interface AutoReconcileBankResponse {
  success: boolean;
  message?: string;
  data: {
    matched_count?: number;
    warning_count?: number;
    skipped_count?: number;
    total_groups?: number;
    results?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

export interface DeleteAllBankReconciliationLinksResponse {
  deleted_count: number;
}

function appendParams<T extends object>(params?: T) {
  const queryParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, String(value));
    }
  });
  return queryParams.toString();
}

async function parseJsonError(response: Response, fallback: string): Promise<never> {
  const error = await response.json().catch(() => ({ error: response.statusText }));
  throw new Error(error.message || error.error || fallback);
}

async function parseDeleteResponse<T>(response: Response, fallback: T): Promise<T> {
  const text = await response.text();
  if (!text) return fallback;
  return JSON.parse(text);
}

function normalizeRowsResponse<T>(json: unknown): PaginatedRowsResponse<T> {
  if (!json || typeof json !== 'object') {
    return { success: false, data: [] };
  }

  const response = json as PaginatedRowsResponse<T> & { data?: unknown };
  if (Array.isArray(response.data)) {
    return response as PaginatedRowsResponse<T>;
  }

  const nestedData = response.data;
  if (nestedData && typeof nestedData === 'object') {
    const nestedRecord = nestedData as {
      rows?: T[];
      transactions?: T[];
      settlement_rows?: T[];
      items?: T[];
    };
    return {
      ...response,
      data:
        (Array.isArray(nestedRecord.rows) && nestedRecord.rows) ||
        (Array.isArray(nestedRecord.transactions) && nestedRecord.transactions) ||
        (Array.isArray(nestedRecord.settlement_rows) && nestedRecord.settlement_rows) ||
        (Array.isArray(nestedRecord.items) && nestedRecord.items) ||
        [],
    };
  }

  return { ...response, data: [] };
}

export async function uploadPaymentGatewayReconciliation(
  files: File[],
  provider: PaymentGatewayProvider = 'payex'
): Promise<UploadPaymentGatewayReconciliationResponse> {
  if (files.length === 0) {
    throw new Error('At least one reconciliation file is required');
  }

  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const query = appendParams({ provider });

  const response = await fetch(`${BASE_URL}/payment-gateways/reconciliations/upload${query ? `?${query}` : ''}`, {
    method: 'POST',
    headers: getScopedHeadersForFormData(),
    body: formData,
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to upload reconciliation files');
  }

  return response.json();
}

export async function listPaymentGatewayReconciliations(
  params?: ListPaymentGatewayBatchesParams
): Promise<ListPaymentGatewayBatchesResponse> {
  const query = appendParams(params);
  const response = await fetch(
    `${BASE_URL}/payment-gateways/reconciliations${query ? `?${query}` : ''}`,
    { method: 'GET', headers: getScopedHeaders() }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to list platform and merchant reconciliations');
  }

  const json = await response.json();
  if (Array.isArray(json.data)) {
    return json;
  }
  if (Array.isArray(json.data?.batches)) {
    return { ...json, data: json.data.batches };
  }
  return { ...json, data: [] };
}

export async function getPaymentGatewayReconciliation(
  batchId: number
): Promise<GetPaymentGatewayReconciliationResponse> {
  const response = await fetch(`${BASE_URL}/payment-gateways/reconciliations/${batchId}`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to get platform and merchant reconciliation');
  }

  return response.json();
}

export async function deletePaymentGatewayReconciliation(
  batchId: number
): Promise<DeletePaymentGatewayReconciliationResponse> {
  const response = await fetch(`${BASE_URL}/payment-gateways/reconciliations/${batchId}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete reconciliation batch');
  }

  return parseDeleteResponse(response, {
    success: true,
    message: 'Reconciliation batch deleted successfully',
    data: null,
  });
}

export async function listPaymentGatewayTransactions(
  batchId: number,
  params?: ListPaymentGatewayTransactionsParams
): Promise<PaginatedRowsResponse<PaymentGatewayTransactionRow>> {
  const query = appendParams(params);
  const response = await fetch(
    `${BASE_URL}/payment-gateways/reconciliations/${batchId}/transactions${query ? `?${query}` : ''}`,
    { method: 'GET', headers: getScopedHeaders() }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to list reconciliation transactions');
  }

  return normalizeRowsResponse<PaymentGatewayTransactionRow>(await response.json());
}

export async function listPaymentGatewaySettlementRows(
  batchId: number,
  params?: ListPaymentGatewaySettlementRowsParams
): Promise<PaginatedRowsResponse<PaymentGatewaySettlementRow>> {
  const query = appendParams(params);
  const response = await fetch(
    `${BASE_URL}/payment-gateways/reconciliations/${batchId}/settlement-rows${query ? `?${query}` : ''}`,
    { method: 'GET', headers: getScopedHeaders() }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to list reconciliation settlement rows');
  }

  return normalizeRowsResponse<PaymentGatewaySettlementRow>(await response.json());
}

export async function createPaymentGatewayBankReconciliationLink(
  payload: CreatePaymentGatewayBankReconciliationLinkRequest
): Promise<CreatePaymentGatewayBankReconciliationLinkResponse> {
  const response = await fetch(`${BASE_URL}/payment-gateways/bank-reconciliation-links`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to create bank reconciliation link');
  }

  return response.json();
}

export async function listPaymentGatewayBankReconciliationLinks(
  batchId: number
): Promise<ListPaymentGatewayBankReconciliationLinksResponse> {
  const response = await fetch(`${BASE_URL}/payment-gateways/reconciliations/${batchId}/bank-reconciliation-links`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to list bank reconciliation links');
  }

  const json = await response.json();
  if (Array.isArray(json.data)) {
    return json;
  }
  if (Array.isArray(json.data?.links)) {
    return { ...json, data: json.data.links };
  }
  return { ...json, data: [] };
}

export async function deletePaymentGatewayBankReconciliationLink(
  linkId: number
): Promise<DeletePaymentGatewayBankReconciliationLinkResponse> {
  const response = await fetch(`${BASE_URL}/payment-gateways/bank-reconciliation-links/${linkId}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete bank reconciliation link');
  }

  return parseDeleteResponse(response, {
    success: true,
    message: 'Bank reconciliation link deleted successfully',
    data: null,
  });
}

export async function deleteAllPaymentGatewayBankReconciliationLinks(
  batchId: number
): Promise<DeleteAllBankReconciliationLinksResponse> {
  const response = await fetch(
    `${BASE_URL}/payment-gateways/reconciliations/${batchId}/bank-reconciliation-links/all`,
    {
      method: 'DELETE',
      headers: getScopedHeaders(),
    }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete all bank reconciliation links');
  }

  return response.json();
}

export async function autoReconcileBank(
  batchId: number,
  payload: AutoReconcileBankRequest
): Promise<AutoReconcileBankResponse> {
  const response = await fetch(
    `${BASE_URL}/payment-gateways/reconciliations/${batchId}/auto-reconcile-bank`,
    {
      method: 'POST',
      headers: getScopedHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to auto-reconcile bank');
  }

  return response.json();
}
