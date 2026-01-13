/**
 * Invoice Service
 * Simple functions to call invoice-related endpoints
 */

import { BASE_URL } from './config';

// Types
export interface InvoiceLineItem {
  id: number;
  line_number?: number;
  description: string;
  quantity: number;
  unit_price: number;
  uom?: string;
  tax_rate?: number;
  line_total: number;
  account_type?: string;
  account_name?: string;
}

export interface BankReconciliation {
  status: 'reconciled';
  transaction_id: number;
  statement_id: number;
  account_number: string;
  transaction_date: string;
  transaction_amount: number;
  transaction_description: string;
  match_score: number;
  match_type: 'auto' | 'manual' | 'suggested';
  reconciled_at: string;
  notes?: string | null;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  invoice_date: string;
  vendor_name: string;
  vendor_address?: string;
  vendor_company_reg_no?: string;
  vendor_phone?: string;
  customer_name?: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status?: string;
  created_at?: string;
  pages_processed?: number;
  processing_time_seconds?: number;
  // URLs for each uploaded page (when provided by multi-page endpoints)
  page_files?: string[];
  lines?: InvoiceLineItem[];
  // Bank reconciliation status (for list endpoint)
  bank_recon_status?: 'reconciled' | null;
  // Bank reconciliation details (for detail endpoint)
  bank_reconciliation?: BankReconciliation | null;
  // Duplicate detection fields
  is_duplicate?: boolean;
  original_invoice_id?: number | null;
  duplicate_group_id?: string | null;
  duplicate_count?: number | null;
  // Handwriting detection fields
  is_handwritten?: boolean | null;
  handwriting_clarity?: 'clear' | 'unclear' | 'mixed' | null;
}

export interface UploadInvoiceResponse {
  success: boolean;
  data: Invoice;
  message: string;
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
    invoice_no?: string;
    vendor_name?: string;
    processing_time_seconds?: number;
    pages_processed?: number;
  };
  message: string;
}

export type InvoiceStatus = 'DRAFT' | 'VALIDATED' | 'POSTED' | 'PAID';

export interface ListInvoicesParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: InvoiceStatus[];
  vendor_id?: number;
  vendor_name?: string;
  currency?: string;
  min_amount?: number;
  max_amount?: number;
  tag?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  date_range?: 'today' | 'week' | 'month' | 'quarter' | 'year';
  month?: number; // 1–12
  year?: number;
}

export interface ListInvoicesData {
  invoices: Invoice[];
  verification?: Record<
    string,
    {
      status: string;
      ok: boolean;
    }
  >;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListInvoicesResponse {
  success: boolean;
  data: ListInvoicesData;
  message: string;
}

export interface GetInvoiceResponse {
  success: boolean;
  data: Invoice;
  message: string;
}

// Validation types
export interface InvoiceValidationAdditionalCosts {
  shipping_fee: string;
  shipping_discount: string;
  shipping_discount_subtotal: string;
  shipping_fee_sst: string;
  service_tax_on_shipping: string;
  voucher_discount: string;
  coin_discount: string;
  service_charge: string;
  platform_fee: string;
  net_additional: string;
}

export interface InvoiceValidationTotals {
  subtotal: string;
  tax: string;
  total: string;
}

export interface InvoiceValidationVerification {
  ok: boolean;
  errors: string[];
  warnings: string[];
  header: InvoiceValidationTotals;
  calc: InvoiceValidationTotals & {
    additional_costs: InvoiceValidationAdditionalCosts;
  };
}

export interface ValidateInvoiceData {
  ok: boolean;
  status: string;
  errors: string[];
  warnings: string[];
  verification: InvoiceValidationVerification;
}

export interface ValidateInvoiceResponse {
  success: boolean;
  data: ValidateInvoiceData;
  message: string;
}

export interface VerifyInvoiceVerification {
  ok: boolean;
  errors: string[];
  warnings: string[];
  header: InvoiceValidationTotals;
  calc: InvoiceValidationTotals & {
    additional_costs: InvoiceValidationAdditionalCosts;
  };
}

export interface VerifyInvoiceData {
  invoice_id: number;
  verification: VerifyInvoiceVerification;
}

export interface VerifyInvoiceResponse {
  success: boolean;
  data: VerifyInvoiceData;
  message: string;
}

export interface UpdateInvoiceRequest {
  invoice_no?: string;
  invoice_date?: string;
  vendor_id?: number;
  status?: string;

  // Vendor
  vendor_name?: string;
  vendor_address?: string;
  vendor_company_reg_no?: string;
  vendor_company_reg_no_old?: string;
  vendor_sst_number?: string;
  vendor_tin_number?: string;
  vendor_phone?: string;
  vendor_email?: string;

  // Customer
  customer_name?: string;
  customer_company_reg_no?: string;
  customer_address?: string;
  customer_sst_number?: string;

  // Amounts
  subtotal?: number;
  tax?: number;
  total?: number;
  service_tax?: number;
  sst?: number;
  gst?: number;
  shipping_fee?: number;
  shipping_discount?: number;
  shipping_discount_subtotal?: number;
  shipping_fee_sst?: number;
  voucher_discount?: number;
  coin_discount?: number;
  platform_fee?: number;
  service_charge?: number;
  other_charges?: number;

  // Banking / payment
  bank_name?: string;
  bank_account_number?: string;
  bank_beneficiary_name?: string;
  bank_swift_code?: string;
  payment_terms?: string;
  payment_method?: string;
  due_date?: string;

  // Misc
  remarks?: string;
  tags?: string;
  currency?: string;
}

export interface UpdateInvoiceResponse {
  success: boolean;
  data: Partial<Invoice>;
  message: string;
}

// Payments
export interface InvoicePayment {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string | null;
  remarks?: string | null;
}

export interface AddPaymentRequest {
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  remarks?: string;
}

export interface AddPaymentResponse {
  success: boolean;
  data: InvoicePayment;
  message: string;
}

export interface DeleteInvoiceResponse {
  success: boolean;
  data: null;
  message: string;
}

export interface BulkDeleteInvoicesRequest {
  invoice_ids: number[];
}

export interface BulkDeleteInvoicesData {
  deleted_count: number;
  deleted_ids: number[];
  total_requested: number;
}

export interface BulkDeleteInvoicesResponse {
  success: boolean;
  data: BulkDeleteInvoicesData;
  message: string;
}

export interface AddLineItemRequest {
  description: string;
  quantity: number;
  unit_price: number;
  uom?: string;
  tax_rate?: number;
  line_total: number;
}

export interface AddLineItemResponse {
  success: boolean;
  data: InvoiceLineItem;
  message: string;
}

export interface UpdateLineItemRequest {
  description?: string;
  quantity?: number;
  unit_price?: number;
  uom?: string;
  tax_rate?: number;
  line_total?: number;
  account_id?: number | null;
}

export interface UpdateLineItemResponse {
  success: boolean;
  data: Partial<InvoiceLineItem>;
  message: string;
}

export interface DeleteLineItemResponse {
  success: boolean;
  data: null;
  message: string;
}

// Batch Upload Types
export interface BatchJob {
  job_id: string;
  invoice_id?: number;
  filename: string;
  file_type: string;
}

export interface BatchUploadResponse {
  success: boolean;
  data: {
    jobs: BatchJob[];
    total_files: number;
    failures?: Array<{
      filename: string;
      file_type: string;
      reason: string;
      index?: number;
    }>;
  };
  message: string;
}

// S3 Batch Upload Types (presigned URL flow)
export interface BatchUploadIntentFileMeta {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface BatchUploadIntentItem {
  index?: number;
  document_id: string | number;
  upload_url: string;
  s3_key?: string;
  filename?: string;
  content_type?: string;
}

export interface BatchUploadIntentResponse {
  success: boolean;
  data: {
    items: BatchUploadIntentItem[];
    s3_bucket?: string;
    expires_in?: number;
    auto_classify?: boolean;
    remark?: string;
    total_files?: number;
  };
  message?: string;
}

export interface BatchConfirmResponse {
  success: boolean;
  data: {
    jobs: BatchJob[];
    total_files: number;
  };
  message: string;
}

function guessContentTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function getFileContentType(file: File): string {
  return file.type || guessContentTypeFromFilename(file.name);
}

async function uploadToPresignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: file,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');

    // Best-effort parse of S3's XML error response:
    // <Error><Code>...</Code><Message>...</Message>...</Error>
    let s3Code: string | undefined;
    let s3Message: string | undefined;
    try {
      if (details && typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(details, 'application/xml');
        s3Code = doc.querySelector('Code')?.textContent?.trim() || undefined;
        s3Message = doc.querySelector('Message')?.textContent?.trim() || undefined;
      }
    } catch {
      // ignore parsing errors
    }

    // Request IDs are very helpful for AWS support / CloudTrail debugging.
    // Note: they may be unavailable unless S3 CORS ExposeHeaders allows them.
    const requestId =
      response.headers.get('x-amz-request-id') ||
      response.headers.get('x-amz-requestid') ||
      undefined;
    const hostId = response.headers.get('x-amz-id-2') || undefined;

    console.error('[S3 PUT] Upload failed', {
      urlHost: (() => {
        try { return new URL(uploadUrl).host; } catch { return undefined; }
      })(),
      filename: file.name,
      size: file.size,
      contentType,
      status: response.status,
      statusText: response.statusText,
      s3Code,
      s3Message,
      requestId,
      hostId,
      responseBodySnippet: details ? details.slice(0, 1200) : undefined,
    });

    const parts: string[] = [];
    if (s3Code) parts.push(s3Code);
    if (s3Message) parts.push(s3Message);
    if (requestId) parts.push(`requestId=${requestId}`);
    const extra = parts.length > 0 ? ` | ${parts.join(' | ')}` : '';

    throw new Error(`S3 upload failed (${response.status} ${response.statusText})${extra}`);
  }
}

export type BatchJobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface BatchJobStatusData {
  id: string;
  user_id: number;
  file_path: string;
  file_type: string;
  original_filename: string;
  status: BatchJobStatus;
  invoice_id: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export type GetBatchJobResponse =
  | { success: true; data: { data: BatchJobStatusData } }
  | { success: false; error: { message: string; status?: number } };

export interface ListBatchJobsParams {
  job_ids?: string[];
}

export interface BatchJobListItem {
  id: string;
  status: BatchJobStatus;
  invoice_id: number | null;
  original_filename: string;
  created_at: string;
}

export interface ListBatchJobsResponse {
  success: boolean;
  data: {
    jobs: BatchJobListItem[];
    total_jobs: number;
  };
  message: string;
}

export interface InvoiceFileDownload {
  blob: Blob;
  contentType: string | null;
  filename?: string | null;
}

export interface BulkVerifyInvoiceResult {
  status: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  header: InvoiceValidationTotals;
  calc: InvoiceValidationTotals & {
    additional_costs: InvoiceValidationAdditionalCosts;
  };
}

export interface BulkVerifyInvoicesResponse {
  success: boolean;
  data: {
    verification: Record<string, BulkVerifyInvoiceResult>;
  };
  message: string;
}

export interface ExportInvoicesRequest {
  invoice_ids: number[];
  template?: 'default' | 'xero_bill' | 'xero_sales';
}

export type ExportInvoicesCsvResponse = InvoiceFileDownload;
export type DownloadInvoicesZipResponse = InvoiceFileDownload;

export interface CheckDuplicateInvoiceParams {
  invoice_no: string;
  vendor_id?: number;
  vendor_name?: string;
}

export interface DuplicateInvoiceInfo {
  id: number;
  invoice_no: string;
  vendor_name: string;
  total: number;
  invoice_date: string;
  created_at: string;
  status: string;
}

export interface CheckDuplicateInvoiceResponse {
  success: boolean;
  data: {
    is_duplicate: boolean;
    existing_invoice: DuplicateInvoiceInfo | null;
  };
  message: string;
}

export interface InvoiceStatisticsFilters {
  start_date?: string;
  end_date?: string;
  vendor_id?: number;
  status?: InvoiceStatus;
  date_range?: 'today' | 'week' | 'month' | 'quarter' | 'year';
}

export interface InvoiceStatisticsSummary {
  total_invoices: number;
  total_value: number;
  average_invoice_value: number;
}

export interface InvoiceStatisticsStatusBucket {
  count: number;
  total_value: number;
}

export interface InvoiceStatisticsTopVendor {
  vendor_id: number;
  vendor_name: string;
  invoice_count: number;
  total_spent: number;
}

export interface InvoiceStatisticsCategory {
  category: string;
  invoice_count: number;
  total_value: number;
}

export interface InvoiceStatisticsMonthlyTrend {
  month: string; // YYYY-MM
  invoice_count: number;
  total_value: number;
}

export interface InvoiceStatisticsRecentActivity {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  description: string;
  created_at: string;
}

export interface InvoiceStatisticsData {
  summary: InvoiceStatisticsSummary;
  status_distribution: Record<string, InvoiceStatisticsStatusBucket>;
  top_vendors: InvoiceStatisticsTopVendor[];
  categories: InvoiceStatisticsCategory[];
  monthly_trends: InvoiceStatisticsMonthlyTrend[];
  recent_activities: InvoiceStatisticsRecentActivity[];
  filters_applied: {
    start_date: string | null;
    end_date: string | null;
    vendor_id: number | null;
    status: string | null;
    time_range: string | null;
  };
}

export interface InvoiceStatisticsResponse {
  success: boolean;
  data: InvoiceStatisticsData;
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
 * Upload and process an invoice file with OCR (Legacy - uses multipart upload)
 * POST /invoices/upload
 * 
 * @deprecated Use uploadInvoiceViaS3() for new implementations
 */
export async function uploadInvoice(
  file: File,
  options?: { auto_classify?: boolean }
): Promise<UploadInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const formData = new FormData();
  formData.append('file', file);
  const queryParams = new URLSearchParams();
  if (options?.auto_classify !== undefined) {
    queryParams.append('auto_classify', String(options.auto_classify));
  }

  const url = `${BASE_URL}/invoices/upload${queryParams.toString() ? `?${queryParams.toString()}` : ''
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
    throw new Error(error.message || error.error || 'Failed to upload invoice');
  }

  return response.json();
}

/**
 * Step 1: Create upload intent and get presigned S3 PUT URL
 * POST /invoices/upload-intent
 */
export async function createInvoiceUploadIntent(
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

  const response = await fetch(`${BASE_URL}/invoices/upload-intent`, {
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
 * POST /invoices/{invoice_id}/confirm-upload
 */
export async function confirmInvoiceUpload(
  invoiceId: number,
  options?: { auto_classify?: boolean }
): Promise<ConfirmUploadResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (options?.auto_classify !== undefined) {
    queryParams.append('auto_classify', String(options.auto_classify));
  }

  const url = `${BASE_URL}/invoices/${invoiceId}/confirm-upload${queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

  const response = await fetch(url, {
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
 * Upload and process an invoice using S3 presigned URLs (recommended)
 * 
 * This is a convenience function that combines the 3-step S3 upload flow:
 * 1. Create upload intent (get presigned PUT URL)
 * 2. Upload file directly to S3
 * 3. Confirm upload and trigger OCR processing
 */
export async function uploadInvoiceViaS3(
  file: File,
  options?: { auto_classify?: boolean }
): Promise<ConfirmUploadResponse> {
  // Step 1: Create upload intent
  const intentResponse = await createInvoiceUploadIntent(file);
  const { document_id, upload_url, required_headers } = intentResponse.data;

  // Step 2: Upload to S3
  await uploadFileToS3(upload_url, file, required_headers);

  // Step 3: Confirm and process
  return confirmInvoiceUpload(document_id, options);
}

/**
 * List all invoices for the current user with pagination and filters
 * GET /invoices
 */
export async function listInvoices(
  params?: ListInvoicesParams
): Promise<ListInvoicesResponse> {
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
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.status && params.status.length > 0) {
    params.status.forEach((s) => queryParams.append('status', s));
  }
  if (params?.vendor_id !== undefined) {
    queryParams.append('vendor_id', params.vendor_id.toString());
  }
  if (params?.vendor_name) {
    queryParams.append('vendor_name', params.vendor_name);
  }
  if (params?.currency) {
    queryParams.append('currency', params.currency);
  }
  if (params?.min_amount !== undefined) {
    queryParams.append('min_amount', params.min_amount.toString());
  }
  if (params?.max_amount !== undefined) {
    queryParams.append('max_amount', params.max_amount.toString());
  }
  if (params?.tag) {
    queryParams.append('tag', params.tag);
  }
  if (params?.start_date) {
    queryParams.append('start_date', params.start_date);
  }
  if (params?.end_date) {
    queryParams.append('end_date', params.end_date);
  }
  if (params?.date_range) {
    queryParams.append('date_range', params.date_range);
  }
  if (params?.month !== undefined) {
    queryParams.append('month', params.month.toString());
  }
  if (params?.year !== undefined) {
    queryParams.append('year', params.year.toString());
  }

  const url = `${BASE_URL}/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''
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
    throw new Error(error.message || error.error || 'Failed to list invoices');
  }

  return response.json();
}

/**
 * Download the original invoice file for preview/download
 * GET /invoices/{invoice_id}/file
 */
export async function downloadInvoiceFile(invoiceId: number): Promise<InvoiceFileDownload> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/file`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // Try to parse JSON error if available
    let message = response.statusText;
    try {
      const err = await response.json();
      message = err.message || err.error || message;
    } catch {
      // ignore JSON parse errors for non-JSON bodies
    }
    throw new Error(message || 'Failed to download invoice file');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('Content-Type');
  const disposition = response.headers.get('Content-Disposition');
  let filename: string | null = null;

  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return { blob, contentType, filename };
}

/**
 * Get detailed invoice information including line items
 * GET /invoices/{invoice_id}
 */
export async function getInvoice(invoiceId: number): Promise<GetInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get invoice');
  }

  return response.json();
}

/**
 * Validate an invoice and run full server-side checks
 * POST /invoices/{invoice_id}/validate
 */
export async function validateInvoice(invoiceId: number): Promise<ValidateInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to validate invoice');
  }

  return response.json();
}

/**
 * Verify invoice subtotals - get server-side verification of invoice header totals vs line items
 * GET /invoices/{invoice_id}/verification
 */
export async function verifyInvoice(invoiceId: number): Promise<VerifyInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/verification`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to verify invoice');
  }

  return response.json();
}

/**
 * Update invoice information
 * PUT /invoices/{invoice_id}
 */
export async function updateInvoice(
  invoiceId: number,
  data: UpdateInvoiceRequest
): Promise<UpdateInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update invoice');
  }

  return response.json();
}

/**
 * Record a payment for an invoice
 * POST /invoices/{invoice_id}/payments
 */
export async function addPayment(
  invoiceId: number,
  data: AddPaymentRequest
): Promise<AddPaymentResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (response.status === 404) {
    throw new Error('Invoice not found');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to record payment');
  }

  return response.json();
}

/**
 * Delete an invoice and its associated file
 * DELETE /invoices/{invoice_id}
 */
export async function deleteInvoice(invoiceId: number): Promise<DeleteInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete invoice');
  }

  return response.json();
}

/**
 * Bulk delete multiple invoices (hard delete)
 * POST /invoices/delete-bulk
 */
export async function bulkDeleteInvoices(
  invoiceIds: number[]
): Promise<BulkDeleteInvoicesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const body: BulkDeleteInvoicesRequest = { invoice_ids: invoiceIds };

  const response = await fetch(`${BASE_URL}/invoices/delete-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete invoices');
  }

  return response.json();
}

/**
 * Add a line item to an invoice
 * POST /invoices/{invoice_id}/lines
 */
export async function addLineItem(
  invoiceId: number,
  data: AddLineItemRequest
): Promise<AddLineItemResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/lines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to add line item');
  }

  return response.json();
}

/**
 * Update an existing line item
 * PUT /invoices/{invoice_id}/lines/{line_id}
 */
export async function updateLineItem(
  invoiceId: number,
  lineId: number,
  data: UpdateLineItemRequest
): Promise<UpdateLineItemResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/lines/${lineId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update line item');
  }

  return response.json();
}

/**
 * Delete a line item from an invoice
 * DELETE /invoices/{invoice_id}/lines/{line_id}
 */
export async function deleteLineItem(
  invoiceId: number,
  lineId: number
): Promise<DeleteLineItemResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/lines/${lineId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete line item');
  }

  return response.json();
}


/**
 * Upload multiple invoice files using S3 presigned URLs
 * 
 * This uses the 3-step S3 upload flow:
 * 1. POST /invoices/batch-upload - Get presigned URLs for all files
 * 2. PUT each file to S3 using the presigned URLs
 * 3. POST /invoices/batch-confirm - Confirm uploads and start processing
 */
export async function batchUploadInvoices(
  files: File[],
  options?: {
    auto_classify?: boolean;
    remark?: string;
  }
): Promise<BatchUploadResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  // Step 1: Get presigned URLs for all files
  const filesMetadata = files.map(f => ({
    filename: f.name,
    content_type: f.type || 'application/octet-stream',
    size_bytes: f.size,
  }));

  const queryParams = new URLSearchParams();
  if (options?.auto_classify !== undefined) {
    queryParams.append('auto_classify', String(options.auto_classify));
  }
  if (options?.remark) {
    queryParams.append('remark', options.remark);
  }

  const intentUrl = `${BASE_URL}/invoices/batch-upload${queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

  const intentResponse = await fetch(intentUrl, {
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

  const intentData: BatchUploadIntentResponse = await intentResponse.json();
  const { items, auto_classify, remark } = intentData.data;

  // Step 2: Upload all files to S3 in parallel
  await Promise.all(
    items.map((item, index) =>
      uploadFileToS3(item.upload_url, files[index], { 'Content-Type': files[index].type || 'application/octet-stream' })
    )
  );

  // Step 3: Confirm all uploads and start processing
  const confirmUrl = `${BASE_URL}/invoices/batch-confirm${queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

  const confirmResponse = await fetch(confirmUrl, {
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
 * Upload multiple invoice files using backend multipart streaming (no S3 direct PUT from browser)
 * POST /invoices/batch-upload-multipart
 *
 * This is useful for local dev when S3 CORS is not configured, or when you want the backend to handle S3 upload.
 */
export async function batchUploadInvoicesMultipart(
  files: File[],
  options?: {
    auto_classify?: boolean;
    remark?: string;
  }
): Promise<BatchUploadResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const queryParams = new URLSearchParams();
  if (options?.auto_classify !== undefined) {
    queryParams.append('auto_classify', String(options.auto_classify));
  }
  if (options?.remark) {
    queryParams.append('remark', options.remark);
  }

  const url = `${BASE_URL}/invoices/batch-upload-multipart${
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
    throw new Error(error.message || error.error || 'Failed to upload invoices');
  }

  return response.json();
}

/**
 * Bulk verify invoice subtotals (list view helper)
 * GET /invoices/verification?invoice_ids=...
 */
export async function bulkVerifyInvoices(
  invoiceIds: number[]
): Promise<BulkVerifyInvoicesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  invoiceIds.forEach((id) => queryParams.append('invoice_ids', id.toString()));

  const url = `${BASE_URL}/invoices/verification?${queryParams.toString() ? queryParams.toString() : ''
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
    throw new Error(error.message || error.error || 'Failed to verify invoices');
  }

  return response.json();
}

/**
 * Export selected invoices to CSV
 * POST /invoices/export
 * @param invoiceIds - Array of invoice IDs to export
 * @param template - Template format: 'default', 'xero_bill', or 'xero_sales'
 */
export async function exportInvoicesCsv(
  invoiceIds: number[],
  template: 'default' | 'xero_bill' | 'xero_sales' = 'default'
): Promise<ExportInvoicesCsvResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const body: ExportInvoicesRequest = { 
    invoice_ids: invoiceIds,
  };

  // Add template as query parameter if specified
  const queryParams = new URLSearchParams();
  if (template && template !== 'default') {
    queryParams.append('template', template);
  }

  const url = `${BASE_URL}/invoices/export${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to export invoices');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('Content-Type');
  const disposition = response.headers.get('Content-Disposition');
  let filename: string | null = null;

  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return { blob, contentType, filename };
}

/**
 * Download original invoice files for selected invoices (ZIP)
 * POST /invoices/download
 */
export async function downloadInvoicesZip(
  invoiceIds: number[]
): Promise<DownloadInvoicesZipResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const body: ExportInvoicesRequest = { invoice_ids: invoiceIds };

  const response = await fetch(`${BASE_URL}/invoices/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to download invoice files');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('Content-Type');
  const disposition = response.headers.get('Content-Disposition');
  let filename: string | null = null;

  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return { blob, contentType, filename };
}

/**
 * Check for duplicate invoice by invoice_no and vendor
 * GET /invoices/check-duplicate
 */
export async function checkDuplicateInvoice(
  params: CheckDuplicateInvoiceParams
): Promise<CheckDuplicateInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  queryParams.append('invoice_no', params.invoice_no);
  if (params.vendor_id !== undefined) {
    queryParams.append('vendor_id', params.vendor_id.toString());
  } else if (params.vendor_name) {
    queryParams.append('vendor_name', params.vendor_name);
  }

  const url = `${BASE_URL}/invoices/check-duplicate?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to check duplicate invoice');
  }

  return response.json();
}

/**
 * Get aggregate invoice statistics
 * GET /invoices/statistics
 */
export async function getInvoiceStatistics(
  filters?: InvoiceStatisticsFilters
): Promise<InvoiceStatisticsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (filters?.start_date) {
    queryParams.append('start_date', filters.start_date);
  }
  if (filters?.end_date) {
    queryParams.append('end_date', filters.end_date);
  }
  if (filters?.vendor_id !== undefined) {
    queryParams.append('vendor_id', filters.vendor_id.toString());
  }
  if (filters?.status) {
    queryParams.append('status', filters.status);
  }
  if (filters?.date_range) {
    queryParams.append('date_range', filters.date_range);
  }

  const url = `${BASE_URL}/invoices/statistics${queryParams.toString() ? `?${queryParams.toString()}` : ''
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
    throw new Error(error.message || error.error || 'Failed to get invoice statistics');
  }

  return response.json();
}

/**
 * Get the status of a single batch job
 * GET /invoices/batch-jobs/{job_id}
 */
export async function getBatchJobStatus(jobId: string): Promise<GetBatchJobResponse> {
  const token = getAccessToken();

  if (!token) {
    return { success: false, error: { message: 'No access token found' } };
  }

  try {
    const response = await fetch(`${BASE_URL}/invoices/batch-jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // Try to parse json (even for non-2xx)
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const msg =
        payload?.message ||
        payload?.error ||
        payload?.detail ||
        response.statusText ||
        'Failed to get batch job status';

      return { success: false, error: { message: msg, status: response.status } };
    }

    return { success: true, data: payload as { data: BatchJobStatusData } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: { message: msg } };
  }
}

/**
 * List batch jobs for the current user
 * GET /invoices/batch-jobs
 */
export async function listBatchJobs(params?: ListBatchJobsParams): Promise<ListBatchJobsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.job_ids && params.job_ids.length > 0) {
    params.job_ids.forEach((jobId) => {
      queryParams.append('job_ids', jobId);
    });
  }

  const url = `${BASE_URL}/invoices/batch-jobs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list batch jobs');
  }

  return response.json();
}

// Multi-Page Invoice Upload Types
export interface UploadGroupResponse {
  success: boolean;
  data: {
    group_id: string;
    page_number: number;
    total_files: number;
    page_numbers: number[];
  };
  message: string;
}

export interface GroupStatusFile {
  file_path: string;
  page_number: number;
  file_type: string;
  uploaded_at: string;
}

export interface GroupStatusData {
  group_id: string;
  user_id: number;
  total_files: number;
  page_numbers: number[];
  created_at: string;
  expires_at: string;
  files: GroupStatusFile[];
}

export interface GetGroupStatusResponse {
  success: boolean;
  data: GroupStatusData;
  message: string;
}

export interface CompleteGroupResponse {
  success: boolean;
  data: Invoice;
  message: string;
}

// Async processing response types
export interface AsyncMultiPageJobResponse {
  success: boolean;
  data: {
    job_id: string;
    group_id: string;
    total_files: number;
    page_numbers: number[];
  };
  message: string;
}

/**
 * Type guard to check if a response is an async job response
 */
export function isAsyncJobResponse(
  response: UploadInvoiceResponse | AsyncMultiPageJobResponse
): response is AsyncMultiPageJobResponse {
  return (
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null &&
    'job_id' in response.data
  );
}

/**
 * Type guard to check if a complete group response is async
 */
export function isAsyncCompleteResponse(
  response: CompleteGroupResponse | AsyncMultiPageJobResponse
): response is AsyncMultiPageJobResponse {
  return (
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null &&
    'job_id' in response.data
  );
}

export interface CancelGroupResponse {
  success: boolean;
  data: {
    group_id: string;
  };
  message: string;
}

/**
 * Upload multiple images for a single invoice in one request
 * POST /invoices/upload-multi
 * 
 * @param files - Array of image files to upload (at least 2 required)
 * @param options - Upload options
 * @param options.page_numbers - Optional array of page numbers for each file
 * @param options.auto_classify - If true, classify invoice lines against chart of accounts
 * @param options.async_process - If true, process asynchronously and return job_id immediately
 * @returns UploadInvoiceResponse (sync) or AsyncMultiPageJobResponse (async)
 */
export async function uploadMultiPageInvoice(
  files: File[],
  options?: {
    page_numbers?: number[];
    auto_classify?: boolean;
    async_process?: boolean;
  }
): Promise<UploadInvoiceResponse | AsyncMultiPageJobResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  if (files.length < 2) {
    throw new Error('At least 2 images are required for multi-page upload');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const queryParams = new URLSearchParams();
  if (options?.page_numbers && options.page_numbers.length > 0) {
    queryParams.append('page_numbers', options.page_numbers.join(','));
  }
  if (options?.auto_classify !== undefined) {
    queryParams.append('auto_classify', String(options.auto_classify));
  }
  if (options?.async_process !== undefined) {
    queryParams.append('async_process', String(options.async_process));
  }

  const url = `${BASE_URL}/invoices/upload-multi${queryParams.toString() ? `?${queryParams.toString()}` : ''
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
    throw new Error(error.message || error.error || 'Failed to upload multi-page invoice');
  }

  return response.json();
}

/**
 * Group upload intent response
 */
interface GroupUploadIntentResponse {
  success: boolean;
  data: {
    group_id: string;
    page_number: number;
    upload_url: string;
    s3_key: string;
    s3_bucket: string;
    required_headers: Record<string, string>;
    expires_in: number;
    total_files: number;
    page_numbers: number[];
  };
}

/**
 * Upload a single image to an invoice group using S3 presigned URL
 * 
 * This uses the 3-step S3 upload flow:
 * 1. POST /invoices/upload-group - Get presigned URL for this page
 * 2. PUT the file to S3 using the presigned URL
 * 3. POST /invoices/upload-group-confirm - Confirm the upload
 */
export async function uploadToGroup(
  file: File,
  pageNumber: number,
  options?: {
    group_id?: string;
  }
): Promise<UploadGroupResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  if (pageNumber < 1) {
    throw new Error('Page number must be >= 1');
  }

  // Step 1: Get presigned URL for this page
  const queryParams = new URLSearchParams();
  queryParams.append('page_number', pageNumber.toString());
  if (options?.group_id) {
    queryParams.append('group_id', options.group_id);
  }

  const intentUrl = `${BASE_URL}/invoices/upload-group?${queryParams.toString()}`;

  const intentResponse = await fetch(intentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    }),
  });

  if (!intentResponse.ok) {
    const error = await intentResponse.json().catch(() => ({ error: intentResponse.statusText }));
    throw new Error(error.message || error.error || 'Failed to create group upload intent');
  }

  const intentData: GroupUploadIntentResponse = await intentResponse.json();
  const { group_id, upload_url, required_headers } = intentData.data;

  // Step 2: Upload file to S3
  await uploadFileToS3(upload_url, file, required_headers);

  // Step 3: Confirm the upload
  const confirmParams = new URLSearchParams();
  confirmParams.append('group_id', group_id);
  confirmParams.append('page_number', pageNumber.toString());

  const confirmResponse = await fetch(`${BASE_URL}/invoices/upload-group-confirm?${confirmParams.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!confirmResponse.ok) {
    const error = await confirmResponse.json().catch(() => ({ error: confirmResponse.statusText }));
    throw new Error(error.message || error.error || 'Failed to confirm group upload');
  }

  return confirmResponse.json();
}

/**
 * Get the status of an invoice upload group
 * GET /invoices/group/{group_id}
 */
export async function getGroupStatus(groupId: string): Promise<GetGroupStatusResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/group/${groupId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get group status');
  }

  return response.json();
}

/**
 * Complete a multi-page invoice upload group
 * POST /invoices/group/{group_id}/complete
 * 
 * @param groupId - The group ID to complete
 * @param options - Completion options
 * @param options.auto_classify - If true, classify invoice lines against chart of accounts
 * @param options.async_process - If true, process asynchronously and return job_id immediately
 * @returns CompleteGroupResponse (sync) or AsyncMultiPageJobResponse (async)
 */
export async function completeGroup(
  groupId: string,
  options?: {
    auto_classify?: boolean;
    async_process?: boolean;
  }
): Promise<CompleteGroupResponse | AsyncMultiPageJobResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (options?.auto_classify !== undefined) {
    queryParams.append('auto_classify', String(options.auto_classify));
  }
  if (options?.async_process !== undefined) {
    queryParams.append('async_process', String(options.async_process));
  }

  const url = `${BASE_URL}/invoices/group/${groupId}/complete${queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to complete group');
  }

  return response.json();
}

/**
 * Cancel and cleanup an incomplete invoice upload group
 * DELETE /invoices/group/{group_id}
 */
export async function cancelGroup(groupId: string): Promise<CancelGroupResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/group/${groupId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to cancel group');
  }

  return response.json();
}

