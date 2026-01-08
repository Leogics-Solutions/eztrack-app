/**
 * Bank Statement Service
 * Functions to call bank statement-related endpoints
 */

import { BASE_URL } from './config';

// Types
export interface BankStatement {
  id: number;
  bank_name?: string;
  branch?: string;
  account_holder_name?: string;
  account_number?: string;
  account_type?: string;
  statement_date_from?: string;
  statement_date_to?: string;
  opening_balance?: number;
  closing_balance?: number;
  file_name?: string;
  file_url?: string;
  page_count?: number;
  ocr_confidence?: number;
  transaction_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BankTransaction {
  id: number;
  bank_statement_id: number;
  transaction_date: string;
  description: string;
  transaction_type: 'DEBIT' | 'CREDIT';
  reference_number?: string | null;
  debit_amount?: number | null;
  credit_amount?: number | null;
  balance?: number | null;
  category?: string | null;
  merchant_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MatchScoreBreakdown {
  amount_score: number;
  date_score: number;
  text_score: number;
  reference_bonus: number;
}

export interface TransactionInvoiceMatch {
  invoice_id: number;
  invoice_no: string;
  vendor_name: string;
  invoice_date: string;
  invoice_total: number;
  match_score: number;
  confidence: 'high' | 'medium' | 'low';
  score_breakdown: MatchScoreBreakdown;
}

export interface TransactionMatchResult {
  transaction_id: number;
  transaction_date: string;
  amount: number;
  description: string;
  matches: TransactionInvoiceMatch[];
}

export interface TransactionInvoiceLink {
  id: number;
  bank_transaction_id: number;
  invoice_id: number;
  match_type: 'auto' | 'manual';
  match_score?: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  transaction?: BankTransaction;
  invoice?: {
    id: number;
    invoice_no: string;
    vendor_name: string;
    total: number;
  };
}

// Request/Response Types
export interface UploadBankStatementResponse {
  success: boolean;
  message: string;
  data: {
    statement_id: number;
    account_number?: string;
    statement_period?: string;
    transaction_count: number;
    opening_balance?: number;
    closing_balance?: number;
    processing_time_seconds?: number;
  };
}

export interface UploadBankStatementAsyncResponse {
  success: boolean;
  message: string;
  data: {
    job_id: string;
    filename: string;
    file_type: string;
  };
}

export type UploadBankStatementResult = UploadBankStatementResponse | UploadBankStatementAsyncResponse;

/**
 * Type guard to check if upload response is async (has job_id)
 */
export function isAsyncUploadResponse(
  response: UploadBankStatementResult
): response is UploadBankStatementAsyncResponse {
  return (
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null &&
    'job_id' in response.data
  );
}

export type BankStatementJobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface BankStatementJob {
  id: string;
  user_id: number;
  file_path: string;
  file_type: string;
  original_filename: string;
  status: BankStatementJobStatus;
  statement_id: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GetBankStatementJobResponse {
  success: boolean;
  message: string;
  data: BankStatementJob;
}

export interface ListBankStatementJobsResponse {
  success: boolean;
  message: string;
  data: {
    jobs: BankStatementJob[];
    total_jobs: number;
  };
}

export interface BatchUploadBankStatementJob {
  job_id: string;
  filename: string;
  file_type: string;
}

export interface BatchUploadBankStatementsResponse {
  success: boolean;
  message: string;
  data: {
    jobs: BatchUploadBankStatementJob[];
    total_files: number;
  };
}

export interface ListBankStatementsParams {
  page?: number;
  page_size?: number;
  account_number?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
}

export interface ListBankStatementsResponse {
  success: boolean;
  message: string;
  data: BankStatement[];
  meta?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface GetBankStatementResponse {
  success: boolean;
  message: string;
  data: BankStatement & {
    transactions?: BankTransaction[];
  };
}

export interface GetStatementTransactionsParams {
  page?: number;
  page_size?: number;
  transaction_type?: 'DEBIT' | 'CREDIT';
  date_from?: string;
  date_to?: string;
}

export interface GetStatementTransactionsResponse {
  success: boolean;
  message: string;
  data: BankTransaction[];
  pagination?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  meta?: {
    timestamp: string;
    request_id: string | null;
  };
}

export interface MatchInvoicesRequest {
  statement_id: number;
  invoice_ids: number[];
  date_tolerance_days?: number;
  amount_tolerance_percentage?: number;
  currency_tolerance_percentage?: number;
  min_match_score?: number;
  exclude_linked?: boolean;
}

export interface MatchInvoicesResponse {
  statement_id: number;
  transactions: TransactionMatchResult[];
}

// Cross-statement matching (no statement_id required)
export interface MatchInvoicesAcrossStatementsRequest {
  invoice_ids: number[];
  date_tolerance_days?: number;
  amount_tolerance_percentage?: number;
  currency_tolerance_percentage?: number;
  min_match_score?: number;
  exclude_linked?: boolean;
}

export interface MatchedInvoiceDetail {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;
  invoice_total: string;
  invoice_currency: string;
  converted_total: string;
  vendor_name: string;
  match_score: string;
  score_breakdown: {
    amount_score: string;
    date_score: string;
    text_score: string;
    reference_bonus: string;
  };
  match_confidence: 'high' | 'medium' | 'low';
}

export interface StatementTransactionMatch {
  transaction_id: number;
  transaction_date: string;
  transaction_amount: string;
  description: string;
  matched: boolean;
  matched_invoices: MatchedInvoiceDetail[];
}

export interface StatementMatchSummary {
  statement_id: number;
  account_number?: string;
  statement_date_from?: string | null;
  statement_date_to?: string | null;
  total_transactions: number;
  matched_transactions: number;
  matches: StatementTransactionMatch[];
}

export interface MatchInvoicesAcrossStatementsResponse {
  total_invoices: number;
  matched_invoices: number;
  unmatched_invoices: number;
  statements_searched: number;
  statement_matches: StatementMatchSummary[];
}

export interface CreateLinkRequest {
  bank_transaction_id: number;
  invoice_id: number;
  match_type: 'auto' | 'manual';
  match_score?: number;
  notes?: string;
}

export interface CreateLinkResponse {
  success: boolean;
  message: string;
  data: TransactionInvoiceLink;
}

export interface CreateLinksBulkRequest {
  links: Array<{
    bank_transaction_id: number;
    invoice_id: number;
    match_type: 'auto' | 'manual';
    match_score?: number;
    notes?: string;
  }>;
}

export interface CreateLinksBulkResponse {
  success: boolean;
  message: string;
  data: {
    created_count: number;
    links: TransactionInvoiceLink[];
  };
}

export interface GetStatementLinksResponse {
  success: boolean;
  message: string;
  data: TransactionInvoiceLink[];
}

export interface DeleteLinkResponse {
  success: boolean;
  message: string;
  data: null;
}

export interface DeleteBankStatementResponse {
  success: boolean;
  message: string;
  data: null;
}

export interface GetAccountNumbersResponse {
  success: boolean;
  message: string;
  data: {
    account_numbers: string[];
  };
}

export interface ReprocessTransactionsResponse {
  success: boolean;
  message: string;
  data: {
    statement_id: number;
    transaction_count: number;
  };
}

// S3 Upload Types
export interface UploadIntentRequest {
  filename: string;
  content_type: string;
  size_bytes?: number;
}

export interface UploadIntentResponse {
  success: boolean;
  data: {
    document_id: number;
    upload_url: string;
    s3_key: string;
    s3_bucket: string;
    required_headers: Record<string, string>;
    expires_in: number;
  };
  message: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
  data: {
    document_id: number;
    status: string;
    size_bytes: number;
    content_type: string;
    processing_started: boolean;
    bank_name?: string;
    account_number?: string;
    transaction_count?: number;
  };
  message: string;
}

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Upload and process a bank statement file (PDF/image) - Legacy multipart upload
 * POST /bank-statements/upload
 * 
 * @deprecated Use uploadBankStatementViaS3() for new implementations
 * @param file - The bank statement file to upload
 * @param asyncProcess - If true, processes asynchronously and returns job_id. If false, processes synchronously.
 */
export async function uploadBankStatement(
  file: File,
  asyncProcess: boolean = false
): Promise<UploadBankStatementResult> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const formData = new FormData();
  formData.append('file', file);

  const queryParams = new URLSearchParams();
  if (asyncProcess) {
    queryParams.append('async_process', 'true');
  }

  const url = `${BASE_URL}/bank-statements/upload${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to upload bank statement');
  }

  return response.json();
}

/**
 * Step 1: Create upload intent and get presigned S3 PUT URL
 * POST /bank-statements/upload-intent
 */
export async function createBankStatementUploadIntent(
  file: File
): Promise<UploadIntentResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const body: UploadIntentRequest = {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  };

  const response = await fetch(`${BASE_URL}/bank-statements/upload-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create upload intent');
  }

  return response.json();
}

/**
 * Step 2: Upload file directly to S3 using presigned PUT URL
 */
export async function uploadFileToS3(
  uploadUrl: string,
  file: File,
  requiredHeaders?: Record<string, string>
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
    ...requiredHeaders,
  };

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Step 3: Confirm upload and trigger OCR processing
 * POST /bank-statements/{statement_id}/confirm-upload
 */
export async function confirmBankStatementUpload(
  statementId: number
): Promise<ConfirmUploadResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/${statementId}/confirm-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to confirm upload');
  }

  return response.json();
}

/**
 * Upload and process a bank statement using S3 presigned URLs (recommended)
 * 
 * This is a convenience function that combines the 3-step S3 upload flow:
 * 1. Create upload intent (get presigned PUT URL)
 * 2. Upload file directly to S3
 * 3. Confirm upload and trigger OCR processing
 */
export async function uploadBankStatementViaS3(
  file: File
): Promise<ConfirmUploadResponse> {
  // Step 1: Create upload intent
  const intentResponse = await createBankStatementUploadIntent(file);
  const { document_id, upload_url, required_headers } = intentResponse.data;

  // Step 2: Upload to S3
  await uploadFileToS3(upload_url, file, required_headers);

  // Step 3: Confirm and process
  return confirmBankStatementUpload(document_id);
}

/**
 * Get the status of a bank statement processing job
 * GET /bank-statements/jobs/{job_id}
 */
export async function getBankStatementJobStatus(
  jobId: string
): Promise<GetBankStatementJobResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/jobs/${jobId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get job status');
  }

  return response.json();
}

/**
 * List all bank statement processing jobs for the current user
 * GET /bank-statements/jobs
 */
export async function listBankStatementJobs(): Promise<ListBankStatementJobsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/jobs`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list jobs');
  }

  return response.json();
}

/**
 * Batch upload intent response item for bank statements
 */
interface BankStatementBatchUploadIntentItem {
  index: number;
  document_id: number;
  upload_url: string;
  s3_key: string;
  filename: string;
}

/**
 * Batch upload intent response for bank statements
 */
interface BankStatementBatchUploadIntentResponse {
  success: boolean;
  data: {
    items: BankStatementBatchUploadIntentItem[];
    s3_bucket: string;
    expires_in: number;
    total_files: number;
  };
}

/**
 * Batch upload multiple bank statement files using S3 presigned URLs
 * 
 * This uses the 3-step S3 upload flow:
 * 1. POST /bank-statements/batch-upload - Get presigned URLs for all files
 * 2. PUT each file to S3 using the presigned URLs
 * 3. POST /bank-statements/batch-confirm - Confirm uploads and start processing
 */
export async function batchUploadBankStatements(
  files: File[]
): Promise<BatchUploadBankStatementsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  if (files.length === 0) {
    throw new Error('At least one file is required');
  }

  // Step 1: Get presigned URLs for all files
  const filesMetadata = files.map(f => ({
    filename: f.name,
    content_type: f.type || 'application/octet-stream',
    size_bytes: f.size,
  }));

  const intentResponse = await fetch(`${BASE_URL}/bank-statements/batch-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ files: filesMetadata }),
  });

  if (!intentResponse.ok) {
    const error = await intentResponse.json().catch(() => ({ error: intentResponse.statusText }));
    throw new Error(error.message || error.error || 'Failed to create batch upload intent');
  }

  const intentData: BankStatementBatchUploadIntentResponse = await intentResponse.json();
  const { items } = intentData.data;

  // Step 2: Upload all files to S3 in parallel
  await Promise.all(
    items.map((item, index) => 
      uploadFileToS3(item.upload_url, files[index], { 'Content-Type': files[index].type || 'application/octet-stream' })
    )
  );

  // Step 3: Confirm all uploads and start processing
  const confirmResponse = await fetch(`${BASE_URL}/bank-statements/batch-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ document_ids: items.map(item => item.document_id) }),
  });

  if (!confirmResponse.ok) {
    const error = await confirmResponse.json().catch(() => ({ error: confirmResponse.statusText }));
    throw new Error(error.message || error.error || 'Failed to confirm batch upload');
  }

  return confirmResponse.json();
}

/**
 * List all bank statements with pagination and filters
 * GET /bank-statements
 */
export async function listBankStatements(
  params?: ListBankStatementsParams
): Promise<ListBankStatementsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();

  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.page_size !== undefined) {
    queryParams.append('page_size', params.page_size.toString());
  }
  if (params?.account_number) {
    queryParams.append('account_number', params.account_number);
  }
  if (params?.date_from) {
    queryParams.append('date_from', params.date_from);
  }
  if (params?.date_to) {
    queryParams.append('date_to', params.date_to);
  }

  const url = `${BASE_URL}/bank-statements${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list bank statements');
  }

  return response.json();
}

/**
 * Get detailed bank statement with all transactions
 * GET /bank-statements/{id}
 */
export async function getBankStatement(
  id: number
): Promise<GetBankStatementResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get bank statement');
  }

  return response.json();
}

/**
 * Get paginated transactions for a specific statement
 * GET /bank-statements/{id}/transactions
 */
export async function getStatementTransactions(
  statementId: number,
  params?: GetStatementTransactionsParams
): Promise<GetStatementTransactionsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();

  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.page_size !== undefined) {
    queryParams.append('page_size', params.page_size.toString());
  }
  if (params?.transaction_type) {
    queryParams.append('transaction_type', params.transaction_type);
  }
  if (params?.date_from) {
    queryParams.append('date_from', params.date_from);
  }
  if (params?.date_to) {
    queryParams.append('date_to', params.date_to);
  }

  const url = `${BASE_URL}/bank-statements/${statementId}/transactions${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get transactions');
  }

  return response.json();
}

/**
 * Match transactions with invoices (invoice-centric matching)
 * POST /bank-statements/{id}/match-invoices
 */
export async function matchInvoices(
  statementId: number,
  invoiceIds: number[],
  options?: {
    date_tolerance_days?: number;
    amount_tolerance_percentage?: number;
    currency_tolerance_percentage?: number;
    min_match_score?: number;
    exclude_linked?: boolean;
  }
): Promise<MatchInvoicesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: MatchInvoicesRequest = {
    statement_id: statementId,
    invoice_ids: invoiceIds,
    date_tolerance_days: options?.date_tolerance_days,
    amount_tolerance_percentage: options?.amount_tolerance_percentage,
    currency_tolerance_percentage: options?.currency_tolerance_percentage,
    min_match_score: options?.min_match_score,
    exclude_linked: options?.exclude_linked,
  };

  const response = await fetch(`${BASE_URL}/bank-statements/${statementId}/match-invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to match invoices');
  }

  return response.json();
}

/**
 * Match invoices across all relevant bank statements
 * POST /bank-statements/match-invoices
 * 
 * This endpoint automatically searches all bank statements that could contain
 * matching transactions based on invoice dates. No statement ID is required.
 */
export async function matchInvoicesAcrossStatements(
  invoiceIds: number[],
  options?: {
    date_tolerance_days?: number;
    amount_tolerance_percentage?: number;
    currency_tolerance_percentage?: number;
    min_match_score?: number;
    exclude_linked?: boolean;
  }
): Promise<MatchInvoicesAcrossStatementsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: MatchInvoicesAcrossStatementsRequest = {
    invoice_ids: invoiceIds,
    date_tolerance_days: options?.date_tolerance_days,
    amount_tolerance_percentage: options?.amount_tolerance_percentage,
    currency_tolerance_percentage: options?.currency_tolerance_percentage,
    min_match_score: options?.min_match_score,
    exclude_linked: options?.exclude_linked,
  };

  const response = await fetch(`${BASE_URL}/bank-statements/match-invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to match invoices across statements');
  }

  return response.json();
}

/**
 * Create a transaction-invoice link (reconciliation)
 * POST /bank-statements/links
 */
export async function createLink(
  transactionId: number,
  invoiceId: number,
  options?: {
    match_type?: 'auto' | 'manual';
    match_score?: number;
    notes?: string;
  }
): Promise<CreateLinkResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: CreateLinkRequest = {
    bank_transaction_id: transactionId,
    invoice_id: invoiceId,
    match_type: options?.match_type || 'manual',
    match_score: options?.match_score,
    notes: options?.notes,
  };

  const response = await fetch(`${BASE_URL}/bank-statements/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create link');
  }

  return response.json();
}

/**
 * Create multiple transaction-invoice links in bulk
 * POST /bank-statements/links/bulk
 */
export async function createLinksBulk(
  links: Array<{
    bank_transaction_id: number;
    invoice_id: number;
    match_type: 'auto' | 'manual';
    match_score?: number;
    notes?: string;
  }>
): Promise<CreateLinksBulkResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: CreateLinksBulkRequest = { links };

  const response = await fetch(`${BASE_URL}/bank-statements/links/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create links');
  }

  return response.json();
}

/**
 * Get all links for a statement
 * GET /bank-statements/{id}/links
 */
export async function getStatementLinks(
  statementId: number
): Promise<GetStatementLinksResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/${statementId}/links`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get links');
  }

  const jsonResponse = await response.json();
  
  // Handle both formats: array directly or wrapped in data property
  if (Array.isArray(jsonResponse)) {
    return {
      success: true,
      message: 'Links retrieved successfully',
      data: jsonResponse,
    };
  }
  
  // If already wrapped, return as is
  return jsonResponse;
}

/**
 * Delete a transaction-invoice link
 * DELETE /bank-statements/links/{link_id}
 */
export async function deleteLink(linkId: number): Promise<DeleteLinkResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/links/${linkId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete link');
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  if (!text || !contentType?.includes('application/json')) {
    // Return default success response if no JSON body
    return {
      success: true,
      message: 'Link deleted successfully',
      data: null,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    // If JSON parsing fails, return default success response
    return {
      success: true,
      message: 'Link deleted successfully',
      data: null,
    };
  }
}

/**
 * Delete a bank statement
 * DELETE /bank-statements/{id}
 */
export async function deleteBankStatement(
  id: number
): Promise<DeleteBankStatementResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete bank statement');
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  if (!text || !contentType?.includes('application/json')) {
    // Return default success response if no JSON body
    return {
      success: true,
      message: 'Bank statement deleted successfully',
      data: null,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    // If JSON parsing fails, return default success response
    return {
      success: true,
      message: 'Bank statement deleted successfully',
      data: null,
    };
  }
}

/**
 * Get all unique account numbers for the current user
 * GET /bank-statements/accounts/list
 */
export async function getAccountNumbers(): Promise<GetAccountNumbersResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/accounts/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get account numbers');
  }

  return response.json();
}

/**
 * Reprocess transactions from an existing bank statement file
 * POST /bank-statements/{id}/reprocess-transactions
 */
export async function reprocessTransactions(
  statementId: number
): Promise<ReprocessTransactionsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/bank-statements/${statementId}/reprocess-transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to reprocess transactions');
  }

  return response.json();
}


