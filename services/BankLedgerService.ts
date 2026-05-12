import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';
import { BASE_URL } from './config';

export type BankLedgerBatchStatus = 'ready' | 'processing' | 'failed' | string;
export type BankLedgerMatchStatus = 'matched' | 'warning' | 'unmatched' | string;

export interface BankLedgerBatch {
  id: number;
  status?: BankLedgerBatchStatus;
  account_number?: string | null;
  file_name?: string | null;
  filename?: string | null;
  ledger_entry_count?: number;
  entry_count?: number;
  linked_count?: number;
  matched_count?: number;
  warning_count?: number;
  unmatched_count?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface BankLedgerEntry {
  id: number;
  batch_id?: number;
  entry_date?: string;
  transaction_date?: string;
  date?: string;
  description?: string | null;
  reference_no?: string | null;
  reference_number?: string | null;
  contact?: string | null;
  account_number?: string | null;
  debit_amount?: number | string | null;
  credit_amount?: number | string | null;
  amount?: number | string | null;
  currency?: string | null;
  bank_link?: BankLedgerBankReconciliationLink | null;
  bank_reconciliation_link?: BankLedgerBankReconciliationLink | null;
  [key: string]: unknown;
}

export interface BankLedgerBankTransaction {
  id?: number;
  bank_statement_id?: number;
  transaction_date?: string;
  description?: string;
  reference_number?: string | null;
  debit_amount?: number | string | null;
  credit_amount?: number | string | null;
  currency?: string | null;
  [key: string]: unknown;
}

export interface BankLedgerBankReconciliationLink {
  id: number;
  batch_id?: number;
  ledger_entry_id?: number;
  ledger_entry_ids?: number[];
  bank_transaction_id: number;
  match_status?: BankLedgerMatchStatus;
  status?: BankLedgerMatchStatus;
  match_type?: string;
  score?: number | string;
  notes?: string | null;
  created_at?: string;
  ledger_entry?: BankLedgerEntry;
  ledger_entries?: BankLedgerEntry[];
  bank_transaction?: BankLedgerBankTransaction;
  [key: string]: unknown;
}

export interface ListBankLedgerReconciliationsParams {
  page?: number;
  page_size?: number;
}

export interface ListBankLedgerReconciliationsResponse {
  success: boolean;
  message?: string;
  data: BankLedgerBatch[];
  meta?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface UploadBankLedgerResponse {
  success: boolean;
  message?: string;
  data: {
    batch?: BankLedgerBatch;
    batch_id?: number;
    [key: string]: unknown;
  };
}

export interface GetBankLedgerReconciliationResponse {
  success: boolean;
  message?: string;
  data: {
    batch?: BankLedgerBatch;
    ledger_entries?: BankLedgerEntry[];
    entries?: BankLedgerEntry[];
    imported_ledger_entries?: BankLedgerEntry[];
    bank_reconciliation_links?: BankLedgerBankReconciliationLink[];
    links?: BankLedgerBankReconciliationLink[];
    [key: string]: unknown;
  };
}

export interface AutoReconcileBankLedgerRequest {
  bank_statement_ids: number[];
  date_tolerance_days?: number;
  amount_tolerance_pct?: number;
  use_llm?: boolean;
}

export interface AutoReconcileBankLedgerResponse {
  success: boolean;
  message?: string;
  data: {
    matched_count?: number;
    warning_count?: number;
    skipped_count?: number;
    total_entries?: number;
    results?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

export interface ListBankLedgerBankLinksResponse {
  success: boolean;
  message?: string;
  data: BankLedgerBankReconciliationLink[];
}

export interface DeleteBankLedgerBankLinkResponse {
  success: boolean;
  message?: string;
  data: null;
}

export interface DeleteBankLedgerReconciliationResponse {
  success: boolean;
  message?: string;
  data: null;
}

export interface DeleteAllBankLedgerBankLinksResponse {
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

export async function uploadBankLedger(file: File): Promise<UploadBankLedgerResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/bank-ledgers/upload`, {
    method: 'POST',
    headers: getScopedHeadersForFormData(),
    body: formData,
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to upload bank ledger');
  }

  return response.json();
}

export async function listBankLedgerReconciliations(
  params?: ListBankLedgerReconciliationsParams
): Promise<ListBankLedgerReconciliationsResponse> {
  const query = appendParams(params);
  const response = await fetch(
    `${BASE_URL}/bank-ledgers/reconciliations${query ? `?${query}` : ''}`,
    { method: 'GET', headers: getScopedHeaders() }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to list bank ledger reconciliations');
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

export async function getBankLedgerReconciliation(
  batchId: number
): Promise<GetBankLedgerReconciliationResponse> {
  const response = await fetch(`${BASE_URL}/bank-ledgers/reconciliations/${batchId}`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to get bank ledger reconciliation');
  }

  return response.json();
}

export async function deleteBankLedgerReconciliation(
  batchId: number
): Promise<DeleteBankLedgerReconciliationResponse> {
  const response = await fetch(`${BASE_URL}/bank-ledgers/reconciliations/${batchId}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete bank ledger reconciliation');
  }

  return parseDeleteResponse(response, {
    success: true,
    message: 'Bank ledger deleted successfully',
    data: null,
  });
}

export async function autoReconcileBankLedger(
  batchId: number,
  payload: AutoReconcileBankLedgerRequest
): Promise<AutoReconcileBankLedgerResponse> {
  const response = await fetch(
    `${BASE_URL}/bank-ledgers/reconciliations/${batchId}/auto-reconcile-bank`,
    {
      method: 'POST',
      headers: getScopedHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to auto-reconcile bank ledger');
  }

  return response.json();
}

export async function listBankLedgerBankReconciliationLinks(
  batchId: number
): Promise<ListBankLedgerBankLinksResponse> {
  const response = await fetch(`${BASE_URL}/bank-ledgers/reconciliations/${batchId}/bank-reconciliation-links`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to list bank ledger reconciliation links');
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

export async function deleteBankLedgerBankReconciliationLink(
  linkId: number
): Promise<DeleteBankLedgerBankLinkResponse> {
  const response = await fetch(`${BASE_URL}/bank-ledgers/bank-reconciliation-links/${linkId}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete bank ledger reconciliation link');
  }

  return parseDeleteResponse(response, {
    success: true,
    message: 'Bank ledger reconciliation link deleted',
    data: null,
  });
}

export async function deleteBankLedgerBankTransactionLinks(
  batchId: number,
  bankTransactionId: number
): Promise<DeleteAllBankLedgerBankLinksResponse> {
  const response = await fetch(
    `${BASE_URL}/bank-ledgers/reconciliations/${batchId}/bank-reconciliation-links?bank_transaction_id=${bankTransactionId}`,
    {
      method: 'DELETE',
      headers: getScopedHeaders(),
    }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete bank transaction reconciliation links');
  }

  return parseDeleteResponse(response, { deleted_count: 0 });
}

export async function deleteAllBankLedgerBankReconciliationLinks(
  batchId: number
): Promise<DeleteAllBankLedgerBankLinksResponse> {
  const response = await fetch(
    `${BASE_URL}/bank-ledgers/reconciliations/${batchId}/bank-reconciliation-links/all`,
    {
      method: 'DELETE',
      headers: getScopedHeaders(),
    }
  );

  if (!response.ok) {
    return parseJsonError(response, 'Failed to delete all bank ledger reconciliation links');
  }

  return parseDeleteResponse(response, { deleted_count: 0 });
}
