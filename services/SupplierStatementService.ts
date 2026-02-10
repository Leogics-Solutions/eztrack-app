/**
 * Supplier Statement Service
 * Functions to call supplier statement-related endpoints
 */

import { BASE_URL } from './config';

// Types
export interface SupplierStatement {
  id: number;
  user_id?: number;
  supplier_name?: string;
  supplier_address?: string;
  statement_date_from?: string;
  statement_date_to?: string;
  total_amount?: number;
  total_payment?: number;
  accounts_receivable?: number;
  currency?: string;
  file_name?: string;
  file_url?: string;
  page_count?: number;
  ocr_confidence?: number;
  line_item_count?: number;
  paid_count?: number;
  unpaid_count?: number;
  created_at?: string;
  updated_at?: string;
  supplier_statement_links?: SupplierStatementInvoiceLink[];
}

export interface SupplierStatementLineItem {
  id: number;
  supplier_statement_id: number;
  transaction_date: string;
  invoice_number?: string | null;
  customer_order_no?: string | null;
  bill_of_lading_no?: string | null;
  amount: number;
  payment_amount?: number | null;
  is_paid: boolean;
  payment_date?: string | null;
  is_released_electronically?: boolean;
  remarks?: string | null;
  currency?: string;
  created_at?: string;
  updated_at?: string;
  invoice_link?: SupplierStatementInvoiceLink | null;
  supplier_statement_links?: SupplierStatementInvoiceLink[];
}

// Request/Response Types
export interface UploadIntentRequest {
  filename: string;
  content_type: string;
  size_bytes: number;
  supplier_name?: string;
}

export interface UploadIntentResponse {
  success: boolean;
  message: string;
  data: {
    document_id: number;
    upload_url: string;
    s3_key: string;
    s3_bucket: string;
    required_headers: {
      'Content-Type': string;
    };
    expires_in: number;
  };
}

export interface ConfirmUploadResponse {
  success: boolean;
  message: string;
  data: {
    document_id: number;
    status: string;
    size_bytes: number;
    content_type: string;
    processing_started: boolean;
    supplier_name?: string;
    line_item_count?: number;
  };
}

export interface UploadSupplierStatementResponse {
  success: boolean;
  message: string;
  data: {
    statement_id: number;
    supplier_name?: string;
    statement_period?: string;
    line_item_count: number;
    total_amount?: number;
    total_payment?: number;
    accounts_receivable?: number;
    processing_time_seconds?: number;
  };
}

export interface UploadSupplierStatementAsyncResponse {
  success: boolean;
  message: string;
  data: {
    job_id: string;
    filename: string;
    file_type: string;
  };
}

export type UploadSupplierStatementResult = UploadSupplierStatementResponse | UploadSupplierStatementAsyncResponse;

export interface ListSupplierStatementsParams {
  page?: number;
  page_size?: number;
  supplier_name?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
}

export interface ListSupplierStatementsResponse {
  success: boolean;
  message: string;
  data: SupplierStatement[];
  meta?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface GetSupplierStatementResponse {
  success: boolean;
  message: string;
  data: SupplierStatement & {
    line_items?: SupplierStatementLineItem[];
  };
}

export interface GetSupplierStatementLineItemsParams {
  page?: number;
  page_size?: number;
  is_paid?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface GetSupplierStatementLineItemsResponse {
  success: boolean;
  message: string;
  data: SupplierStatementLineItem[];
  meta?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface ListSupplierNamesResponse {
  success: boolean;
  message: string;
  data: {
    supplier_names: string[];
  };
}

export interface DeleteSupplierStatementResponse {
  success: boolean;
  message: string;
  data: {
    statement_id: number;
  };
}

// Supplier Statement Invoice Link Types
export interface SupplierStatementInvoiceLink {
  id: number;
  supplier_statement_line_item_id: number;
  invoice_id: number;
  match_type: 'auto' | 'manual';
  match_score?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  line_item?: SupplierStatementLineItem;
  invoice?: {
    id: number;
    invoice_no: string;
    vendor_name: string;
    total: number;
  };
}

export interface CreateSupplierStatementLinkRequest {
  supplier_statement_line_item_id: number;
  invoice_id: number;
  match_type: 'auto' | 'manual';
  match_score?: number;
  notes?: string;
}

export interface CreateSupplierStatementLinkResponse {
  success: boolean;
  message: string;
  data: SupplierStatementInvoiceLink;
}

export interface CreateSupplierStatementLinksBulkRequest {
  links: Array<{
    supplier_statement_line_item_id: number;
    invoice_id: number;
    match_type: 'auto' | 'manual';
    match_score?: number;
    notes?: string;
  }>;
}

export interface CreateSupplierStatementLinksBulkResponse {
  success: boolean;
  message: string;
  data: {
    created_count: number;
    links: SupplierStatementInvoiceLink[];
  };
}

export interface GetInvoiceSupplierStatementLinksResponse {
  success: boolean;
  message: string;
  data: SupplierStatementInvoiceLink[];
}

export interface DeleteSupplierStatementLinkResponse {
  success: boolean;
  message: string;
  data: null;
}

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Create upload intent and get presigned S3 URL
 * POST /supplier-statements/upload-intent
 */
export async function createUploadIntent(
  filename: string,
  contentType: string,
  sizeBytes: number,
  supplierName?: string
): Promise<UploadIntentResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: UploadIntentRequest = {
    filename,
    content_type: contentType,
    size_bytes: sizeBytes,
    ...(supplierName && { supplier_name: supplierName }),
  };

  const response = await fetch(`${BASE_URL}/supplier-statements/upload-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create upload intent');
  }

  return response.json();
}

/**
 * Confirm upload and trigger OCR processing
 * POST /supplier-statements/{statement_id}/confirm-upload
 */
export async function confirmUpload(
  statementId: number
): Promise<ConfirmUploadResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/supplier-statements/${statementId}/confirm-upload`, {
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
 * Upload and process a supplier statement file (PDF/image/Excel) - Legacy multipart
 * POST /supplier-statements/upload
 * 
 * @param file - The supplier statement file to upload (PDF, image, or Excel)
 * @param asyncProcess - If true, processes asynchronously and returns job_id. If false, processes synchronously.
 * @param supplierName - Optional supplier name to override OCR-extracted name
 */
export async function uploadSupplierStatement(
  file: File,
  asyncProcess: boolean = false,
  supplierName?: string
): Promise<UploadSupplierStatementResult> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const formData = new FormData();
  formData.append('file', file);
  if (supplierName) {
    formData.append('supplier_name', supplierName);
  }

  const queryParams = new URLSearchParams();
  if (asyncProcess) {
    queryParams.append('async_process', 'true');
  }

  const url = `${BASE_URL}/supplier-statements/upload${
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
    throw new Error(error.message || error.error || 'Failed to upload supplier statement');
  }

  return response.json();
}

/**
 * List all supplier statements with pagination and filters
 * GET /supplier-statements
 */
export async function listSupplierStatements(
  params?: ListSupplierStatementsParams
): Promise<ListSupplierStatementsResponse> {
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
  if (params?.supplier_name) {
    queryParams.append('supplier_name', params.supplier_name);
  }
  if (params?.date_from) {
    queryParams.append('date_from', params.date_from);
  }
  if (params?.date_to) {
    queryParams.append('date_to', params.date_to);
  }

  const url = `${BASE_URL}/supplier-statements${
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
    throw new Error(error.message || error.error || 'Failed to list supplier statements');
  }

  return response.json();
}

/**
 * Get detailed supplier statement with all line items
 * GET /api/v1/supplier-statements/{id}
 * 
 * Note: The API may return line items directly in the data array.
 * If that's the case, we need to handle it differently.
 */
export async function getSupplierStatement(
  id: number
): Promise<GetSupplierStatementResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/supplier-statements/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get supplier statement');
  }

  const jsonResponse = await response.json();
  
  // Handle different response formats:
  // 1. Direct statement object (no wrapper)
  if (jsonResponse.id && jsonResponse.supplier_statement_id === undefined) {
    // This is a statement object returned directly
    return {
      success: true,
      message: 'Supplier statement retrieved successfully',
      data: jsonResponse as SupplierStatement & { line_items?: SupplierStatementLineItem[] },
    };
  }
  
  // 2. Wrapped response with success/data structure
  if (jsonResponse.success && jsonResponse.data) {
    // If data is an array of line items (unexpected format)
    if (Array.isArray(jsonResponse.data)) {
      const firstItem = jsonResponse.data[0];
      if (firstItem && firstItem.supplier_statement_id) {
        // Try to get the statement from the list endpoint
        try {
          const listResponse = await listSupplierStatements({ page: 1, page_size: 100 });
          const statement = listResponse.data.find(s => s.id === id);
          if (statement) {
            return {
              success: true,
              message: jsonResponse.message || 'Supplier statement retrieved successfully',
              data: {
                ...statement,
                line_items: jsonResponse.data,
              },
            };
          }
        } catch (err) {
          console.error('Failed to fetch statement from list', err);
          throw new Error('Unable to retrieve statement details. The API returned line items instead of statement details.');
        }
        throw new Error(`Supplier statement with id ${id} not found`);
      }
      throw new Error(`Supplier statement with id ${id} not found or has no line items`);
    }
    
    // Normal wrapped response with statement object in data
    return jsonResponse;
  }
  
  // 3. Fallback: assume it's a statement object even if structure is unclear
  if (jsonResponse.id) {
    return {
      success: true,
      message: 'Supplier statement retrieved successfully',
      data: jsonResponse as SupplierStatement & { line_items?: SupplierStatementLineItem[] },
    };
  }
  
  // If we can't identify the format, throw an error
  throw new Error('Unexpected response format from API');
}

/**
 * Get paginated line items for a specific supplier statement
 * GET /supplier-statements/{id}/line-items
 */
export async function getSupplierStatementLineItems(
  statementId: number,
  params?: GetSupplierStatementLineItemsParams
): Promise<GetSupplierStatementLineItemsResponse> {
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
  if (params?.is_paid !== undefined) {
    queryParams.append('is_paid', params.is_paid.toString());
  }
  if (params?.date_from) {
    queryParams.append('date_from', params.date_from);
  }
  if (params?.date_to) {
    queryParams.append('date_to', params.date_to);
  }

  const url = `${BASE_URL}/supplier-statements/${statementId}/line-items${
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
    throw new Error(error.message || error.error || 'Failed to get line items');
  }

  return response.json();
}

/**
 * Get all unique supplier names for the current user
 * GET /supplier-statements/suppliers/list
 */
export async function getSupplierNames(): Promise<ListSupplierNamesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/supplier-statements/suppliers/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get supplier names');
  }

  return response.json();
}

/**
 * Delete a supplier statement
 * DELETE /supplier-statements/{id}
 */
export async function deleteSupplierStatement(
  id: number
): Promise<DeleteSupplierStatementResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/supplier-statements/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete supplier statement');
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  if (!text || !contentType?.includes('application/json')) {
    // Return default success response if no JSON body
    return {
      success: true,
      message: 'Supplier statement deleted successfully',
      data: {
        statement_id: id,
      },
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    // If JSON parsing fails, return default success response
    return {
      success: true,
      message: 'Supplier statement deleted successfully',
      data: {
        statement_id: id,
      },
    };
  }
}

/**
 * Create a supplier statement line item to invoice link
 * POST /api/v1/supplier-statements/links
 */
export async function createSupplierStatementLink(
  lineItemId: number,
  invoiceId: number,
  options?: {
    match_type?: 'auto' | 'manual';
    match_score?: number;
    notes?: string;
  }
): Promise<CreateSupplierStatementLinkResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: CreateSupplierStatementLinkRequest = {
    supplier_statement_line_item_id: lineItemId,
    invoice_id: invoiceId,
    match_type: options?.match_type || 'manual',
    match_score: options?.match_score,
    notes: options?.notes,
  };

  const response = await fetch(`${BASE_URL}/supplier-statements/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create supplier statement link');
  }

  return response.json();
}

/**
 * Create multiple supplier statement line item to invoice links in bulk
 * POST /api/v1/supplier-statements/links/bulk
 */
export async function createSupplierStatementLinksBulk(
  links: Array<{
    supplier_statement_line_item_id: number;
    invoice_id: number;
    match_type: 'auto' | 'manual';
    match_score?: number;
    notes?: string;
  }>
): Promise<CreateSupplierStatementLinksBulkResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const requestBody: CreateSupplierStatementLinksBulkRequest = { links };

  const response = await fetch(`${BASE_URL}/supplier-statements/links/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create supplier statement links');
  }

  return response.json();
}

/**
 * Get all supplier statement links for a specific invoice
 * GET /api/v1/supplier-statements/invoices/{invoice_id}/links
 */
export async function getInvoiceSupplierStatementLinks(
  invoiceId: number
): Promise<GetInvoiceSupplierStatementLinksResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/supplier-statements/invoices/${invoiceId}/links`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get supplier statement links');
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
 * Delete a supplier statement invoice link
 * DELETE /api/v1/supplier-statements/links/{link_id}
 */
export async function deleteSupplierStatementLink(
  linkId: number
): Promise<DeleteSupplierStatementLinkResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/supplier-statements/links/${linkId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete supplier statement link');
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  if (!text || !contentType?.includes('application/json')) {
    // Return default success response if no JSON body
    return {
      success: true,
      message: 'Supplier statement link deleted successfully',
      data: null,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    // If JSON parsing fails, return default success response
    return {
      success: true,
      message: 'Supplier statement link deleted successfully',
      data: null,
    };
  }
}

